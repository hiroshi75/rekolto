import type { Context } from "grammy";
import { logger } from "../../utils/logger.js";
import { scrapeUrl } from "../../services/scraper.js";
import { summarizeContent, extractMemoryFacts } from "../../services/ai.js";
import { createItem } from "../../db/items.js";
import { addTagsToItem } from "../../db/tags.js";
import { findOrCreateCategory, createMemoryItem } from "../../db/memory-store.js";

/**
 * Handle messages containing URLs.
 * Scrapes the URL, summarizes with AI, saves to DB, extracts memory facts, and replies.
 */
export async function handleUrl(ctx: Context, url: string): Promise<void> {
  const statusMsg = await ctx.reply("⏳ 処理中...");

  try {
    // Scrape the URL
    const scraped = await scrapeUrl(url);

    // AI: summarize content and extract memory facts in parallel
    const [summary, memoryResult] = await Promise.all([
      summarizeContent(scraped.content, scraped.title),
      extractMemoryFacts(scraped.content, scraped.title),
    ]);

    // Create item in DB
    const item = createItem({
      type: summary.type,
      title: scraped.title,
      url,
      content: scraped.content,
      summary: summary.summary,
      og_image: scraped.ogImage,
    });

    // Add tags
    if (summary.tags.length > 0) {
      addTagsToItem(item.id, summary.tags);
    }

    // Store memory facts
    for (const fact of memoryResult.facts) {
      const category = findOrCreateCategory(memoryResult.category);
      createMemoryItem({
        category_id: category.id,
        type: fact.type,
        content: fact.content,
        source_id: item.id,
      });
    }

    // Format tags for display
    const tagsDisplay = summary.tags.map((t) => `#${t}`).join(" ");

    // Build response
    const lines = [
      "✅ 保存しました！",
      `📄 ${scraped.title}`,
      `📝 ${summary.summary}`,
    ];
    if (tagsDisplay) {
      lines.push(`🏷️ ${tagsDisplay}`);
    }
    lines.push(`🆔 ${item.id}`);

    const responseText = lines.join("\n");

    // Edit the status message with the result
    await ctx.api.editMessageText(
      statusMsg.chat.id,
      statusMsg.message_id,
      responseText,
    );

    logger.info({ itemId: item.id, url, title: scraped.title, type: summary.type }, "URL saved");
  } catch (err) {
    logger.error({ err, url }, "Failed to handle URL");

    // Try to edit the status message with an error
    try {
      await ctx.api.editMessageText(
        statusMsg.chat.id,
        statusMsg.message_id,
        "❌ URL の保存に失敗しました。もう一度お試しください。",
      );
    } catch {
      await ctx.reply("❌ URL の保存に失敗しました。もう一度お試しください。");
    }
  }
}
