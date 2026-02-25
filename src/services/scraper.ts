import * as cheerio from "cheerio";
import { loadConfig } from "../utils/config.js";
import { logger } from "../utils/logger.js";

export interface ScrapedContent {
  title: string;
  content: string;
  ogImage?: string;
  publishedDate?: string;
}

/**
 * Fetch HTML from a URL with timeout from config.
 */
async function fetchHtml(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Rekolto/0.1; +https://github.com/rekolto)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extract metadata (title, og:image, published date) using cheerio.
 */
function extractMetadata($: cheerio.CheerioAPI): {
  title: string;
  ogImage?: string;
  publishedDate?: string;
} {
  // Title: prefer og:title, then <title> tag
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const titleTag = $("title").text().trim();
  const title = ogTitle || titleTag || "Untitled";

  // OG image
  const ogImage =
    $('meta[property="og:image"]').attr("content") || undefined;

  // Published date: check common meta tags
  const publishedDate =
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="date"]').attr("content") ||
    $('meta[name="DC.date"]').attr("content") ||
    $('meta[property="og:article:published_time"]').attr("content") ||
    $("time[datetime]").first().attr("datetime") ||
    undefined;

  return { title, ogImage, publishedDate };
}

/**
 * Extract the main article body text using cheerio.
 *
 * Strategy:
 * 1. Remove non-content elements (script, style, nav, header, footer, aside, etc.)
 * 2. Look for <article> or <main> elements first
 * 3. Fall back to the <body> text
 * 4. Clean up excessive whitespace
 */
function extractContent($: cheerio.CheerioAPI): string {
  // Clone the document so we don't mutate the original
  const $clone = cheerio.load($.html());

  // Remove non-content elements
  $clone(
    "script, style, noscript, iframe, svg, nav, header, footer, aside, " +
      "form, button, [role='navigation'], [role='banner'], [role='contentinfo'], " +
      "[aria-hidden='true'], .sidebar, .nav, .menu, .footer, .header, " +
      ".advertisement, .ad, .social-share, .comments"
  ).remove();

  // Try to find article content in order of preference
  const selectors = [
    "article",
    '[role="main"]',
    "main",
    ".post-content",
    ".article-content",
    ".entry-content",
    ".content",
    "#content",
    ".post",
    ".article",
  ];

  for (const selector of selectors) {
    const el = $clone(selector);
    if (el.length > 0) {
      const text = el.first().text().trim();
      if (text.length > 100) {
        return cleanText(text);
      }
    }
  }

  // Fall back to body text
  const bodyText = $clone("body").text().trim();
  return cleanText(bodyText);
}

/**
 * Clean up extracted text: collapse whitespace and blank lines.
 */
function cleanText(text: string): string {
  return text
    .replace(/[ \t]+/g, " ") // collapse horizontal whitespace
    .replace(/\n\s*\n/g, "\n\n") // collapse multiple blank lines to one
    .replace(/^\s+|\s+$/gm, "") // trim each line
    .trim();
}

/**
 * Scrape a URL and extract title, content, og:image, and published date.
 */
export async function scrapeUrl(url: string): Promise<ScrapedContent> {
  const config = loadConfig();
  const { timeout_ms, max_content_length } = config.scraper;

  logger.info({ url }, "Scraping URL");

  const html = await fetchHtml(url, timeout_ms);
  const $ = cheerio.load(html);

  const { title, ogImage, publishedDate } = extractMetadata($);
  let content = extractContent($);

  // Truncate content if it exceeds the configured max length
  if (content.length > max_content_length) {
    content = content.slice(0, max_content_length);
    logger.info(
      { url, originalLength: content.length, maxLength: max_content_length },
      "Content truncated to max length"
    );
  }

  logger.info(
    { url, title, contentLength: content.length },
    "Scraping complete"
  );

  return {
    title,
    content,
    ogImage: ogImage || undefined,
    publishedDate: publishedDate || undefined,
  };
}
