import { getBrowserRelayServer } from "./browser-relay.js";
import {
  filterRelevantTweets,
  summarizeContent,
  extractMemoryFacts,
} from "./ai.js";
import type { TweetData } from "./ai.js";
import { createItem } from "../db/items.js";
import { addTagsToItem, getAllTags } from "../db/tags.js";
import {
  getAllCategories,
  findOrCreateCategory,
  createMemoryItem,
} from "../db/memory-store.js";
import { readCrawlerSettings } from "../db/crawler-settings.js";
import { loadConfig } from "../utils/config.js";
import { logger } from "../utils/logger.js";

/** Get current HH:MM in the given IANA timezone */
function currentTimeInTz(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());

    const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
    return `${hour}:${minute}`;
  } catch {
    return "00:00";
  }
}

export class XCrawler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastFiredMinute: string | null = null;
  private crawling = false;

  start(): void {
    logger.info("Starting X crawler tick loop (60s interval)");

    // Run a tick immediately to check
    this.tick();

    this.timer = setInterval(() => {
      this.tick();
    }, 60_000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info("X crawler stopped");
    }
  }

  private tick(): void {
    if (this.crawling) return;

    let settings;
    try {
      settings = readCrawlerSettings();
    } catch (err) {
      logger.error({ err }, "X crawler: failed to read settings");
      return;
    }

    if (!settings.enabled) return;
    if (settings.scheduled_times.length === 0) return;

    const now = currentTimeInTz(settings.timezone);

    // Prevent double-fire in the same minute
    if (now === this.lastFiredMinute) return;

    if (!settings.scheduled_times.includes(now)) return;

    this.lastFiredMinute = now;
    logger.info({ time: now, timezone: settings.timezone }, "X crawler: scheduled time matched, starting crawl");

    this.crawling = true;
    this.crawl(settings.max_items_per_crawl)
      .catch((err) => logger.error({ err }, "X crawler error"))
      .finally(() => {
        this.crawling = false;
      });
  }

  private async crawl(maxItems: number): Promise<void> {
    const config = loadConfig();
    const relay = getBrowserRelayServer();

    if (!relay || !relay.isConnected()) {
      logger.debug("X crawler: browser relay not connected, skipping");
      return;
    }

    logger.info("X crawler: starting crawl");

    try {
      // 1. Fetch the timeline page
      const { html } = await relay.fetchPage(config.x_crawler.timeline_url);

      // 2. Extract tweets from rendered HTML
      const tweets = this.extractTweets(html);
      if (tweets.length === 0) {
        logger.info("X crawler: no tweets extracted from timeline");
        return;
      }
      logger.info({ count: tweets.length }, "X crawler: extracted tweets");

      // 3. Get user interests from DB
      const categories = getAllCategories().map((c) => c.name);
      const tags = getAllTags()
        .map((t) => t.name)
        .slice(0, 30);

      // 4. Filter tweets by relevance using LLM
      const filtered = await filterRelevantTweets(tweets, {
        categories,
        tags,
      });
      logger.info(
        { filtered: filtered.length },
        "X crawler: filtered relevant tweets"
      );

      // 5. Save relevant tweets (up to max_items_per_crawl)
      const toSave = filtered.slice(0, maxItems);

      for (const { index, reason } of toSave) {
        const tweet = tweets[index];
        try {
          await this.saveTweet(tweet, reason);
        } catch (err) {
          logger.error(
            { err, tweet: tweet.text.slice(0, 80) },
            "X crawler: failed to save tweet"
          );
        }
      }

      logger.info({ saved: toSave.length }, "X crawler: crawl complete");
    } catch (err) {
      logger.error({ err }, "X crawler: crawl failed");
    }
  }

  private extractTweets(html: string): TweetData[] {
    const tweets: TweetData[] = [];

    // Extract tweet text from the rendered HTML
    // X.com uses data-testid="tweetText" for tweet content
    const tweetTextRegex =
      /data-testid="tweetText"[^>]*>([\s\S]*?)<\/div>/gi;
    let match;
    while ((match = tweetTextRegex.exec(html)) !== null) {
      // Strip HTML tags to get plain text
      const text = match[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (text.length > 10) {
        tweets.push({ text });
      }
    }

    return tweets;
  }

  private async saveTweet(tweet: TweetData, reason: string): Promise<void> {
    const content = tweet.author
      ? `@${tweet.author}: ${tweet.text}`
      : tweet.text;

    // Use the existing summarization pipeline
    const summary = await summarizeContent(content, "X/Twitter Post");

    const item = createItem({
      type: summary.type,
      title: tweet.author ? `@${tweet.author} on X` : "Post from X",
      url: tweet.url,
      content,
      summary: summary.summary,
    });

    // Add tags from summarization
    if (summary.tags.length > 0) {
      addTagsToItem(item.id, summary.tags);
    }

    // Extract memory facts
    const memoryResult = await extractMemoryFacts(content);
    if (memoryResult.facts.length > 0) {
      const category = findOrCreateCategory(memoryResult.category);
      for (const fact of memoryResult.facts) {
        createMemoryItem({
          category_id: category.id,
          type: fact.type,
          content: fact.content,
          source_id: item.id,
        });
      }
    }

    logger.info(
      { itemId: item.id, reason },
      "X crawler: saved tweet as item"
    );
  }
}

// Singleton
let _crawler: XCrawler | null = null;

export function startXCrawler(): void {
  if (_crawler) return;
  _crawler = new XCrawler();
  _crawler.start();
}

export function stopXCrawler(): void {
  _crawler?.stop();
  _crawler = null;
}
