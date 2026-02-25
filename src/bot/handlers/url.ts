import type { Context } from "grammy";
import { logger } from "../../utils/logger.js";
import { scrapeUrl } from "../../services/scraper.js";
import { summarizeContent, extractMemoryFacts } from "../../services/ai.js";
import { createItem } from "../../db/items.js";
import { addTagsToItem } from "../../db/tags.js";
import { findOrCreateCategory, createMemoryItem, getAllCategories } from "../../db/memory-store.js";
import { suggestCategory, summarizeCategory } from "../../memory/categorize.js";
import { getProactiveSuggestions } from "../../memory/proactive.js";

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

    // Use LLM-based category suggestion for better categorization
    const existingCategories = getAllCategories().map((c) => c.name);
    const categoryName = memoryResult.facts.length > 0
      ? await suggestCategory(scraped.content, existingCategories)
      : memoryResult.category;

    // Store memory facts
    let categoryId: number | null = null;
    for (const fact of memoryResult.facts) {
      const category = findOrCreateCategory(categoryName);
      categoryId = category.id;
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

    logger.info({ itemId: item.id, url, title: scraped.title, type: summary.type, category: categoryName }, "URL saved");

    // Proactive suggestions (non-blocking, separate message)
    if (categoryId !== null) {
      summarizeCategory(categoryId).catch(() => {});

      getProactiveSuggestions({ newItemCategory: categoryName }).then(async (suggestions) => {
        if (suggestions.length > 0) {
          const sugLines = ["💡 関連する提案:"];
          for (const s of suggestions) {
            sugLines.push(`  • ${s}`);
          }
          await ctx.reply(sugLines.join("\n")).catch(() => {});
        }
      }).catch(() => {});
    }
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
