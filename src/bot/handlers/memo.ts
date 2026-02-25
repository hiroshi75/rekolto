import type { Context } from "grammy";
import { logger } from "../../utils/logger.js";
import { summarizeContent, extractMemoryFacts } from "../../services/ai.js";
import { createItem } from "../../db/items.js";
import { addTagsToItem } from "../../db/tags.js";
import { findOrCreateCategory, createMemoryItem, getAllCategories } from "../../db/memory-store.js";
import { suggestCategory, summarizeCategory } from "../../memory/categorize.js";
import { getProactiveSuggestions } from "../../memory/proactive.js";

/**
 * Handle plain text messages (not commands, not URLs).
 * Summarizes the memo with AI, saves to DB, extracts memory facts, and replies.
 */
export async function handleMemo(ctx: Context): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  const statusMsg = await ctx.reply("⏳ 処理中...");

  try {
    // AI: summarize content and extract memory facts in parallel
    const [summary, memoryResult] = await Promise.all([
      summarizeContent(text),
      extractMemoryFacts(text),
    ]);

    // Create item in DB
    const item = createItem({
      type: summary.type,
      content: text,
      summary: summary.summary,
    });

    // Add tags
    if (summary.tags.length > 0) {
      addTagsToItem(item.id, summary.tags);
    }

    // Use LLM-based category suggestion for better categorization
    const existingCategories = getAllCategories().map((c) => c.name);
    const categoryName = memoryResult.facts.length > 0
      ? await suggestCategory(text, existingCategories)
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

    logger.info({ itemId: item.id, type: summary.type, tags: summary.tags, category: categoryName }, "Memo saved");

    // Proactive suggestions (non-blocking, separate message)
    if (categoryId !== null) {
      // Update category summary in background
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
    logger.error({ err }, "Failed to handle memo");

    // Try to edit the status message with an error
    try {
      await ctx.api.editMessageText(
        statusMsg.chat.id,
        statusMsg.message_id,
        "❌ メモの保存に失敗しました。もう一度お試しください。",
      );
    } catch {
      // If editing fails, try a plain reply
      await ctx.reply("❌ メモの保存に失敗しました。もう一度お試しください。");
    }
  }
}
