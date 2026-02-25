import type { Context } from "grammy";
import { logger } from "../../utils/logger.js";
import { searchItems, searchMemoryItems } from "../../db/fts.js";

/**
 * Format a date string for display (YYYY/MM/DD).
 */
function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
  } catch {
    return dateStr;
  }
}

/**
 * Handle /search command.
 * Searches items and memory via FTS5 and returns formatted results.
 */
export async function handleSearch(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? "";
  const query = text.replace(/^\/search\s*/, "").trim();

  if (!query) {
    await ctx.reply("使い方: /search <検索クエリ>\n例: /search RAG チャンク分割");
    return;
  }

  try {
    // Search items and memory items via FTS5
    const items = searchItems(query, 10);
    const memoryItems = searchMemoryItems(query, 5);

    if (items.length === 0 && memoryItems.length === 0) {
      await ctx.reply("🔍 見つかりませんでした");
      return;
    }

    const lines: string[] = [];

    if (items.length > 0) {
      lines.push(`🔍 ${items.length} 件見つかりました`);
      lines.push("");

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const icon = item.type === "memo" ? "📝" : "📄";
        const date = formatDate(item.created_at);
        const title = item.title || item.summary?.slice(0, 50) || item.content.slice(0, 50);

        lines.push(`${i + 1}. ${icon} ${title} (${date})`);

        if (item.summary) {
          // Show first line of summary, indented
          const summaryLine = item.summary.split("\n")[0].slice(0, 100);
          lines.push(`   → ${summaryLine}`);
        }

        lines.push(`   🆔 ${item.id}`);
        lines.push("");
      }
    }

    if (memoryItems.length > 0) {
      lines.push(`🧠 関連する記憶: ${memoryItems.length} 件`);
      lines.push("");

      for (const mi of memoryItems) {
        lines.push(`  • ${mi.content}`);
      }
    }

    await ctx.reply(lines.join("\n"));

    logger.info({ query, itemCount: items.length, memoryCount: memoryItems.length }, "Search completed");
  } catch (err) {
    logger.error({ err, query }, "Failed to handle search");
    await ctx.reply("❌ 検索に失敗しました。もう一度お試しください。");
  }
}
