import type { Context } from "grammy";
import { logger } from "../../utils/logger.js";
import { getDb } from "../../db/database.js";
import { getTagsForItem } from "../../db/tags.js";
import type { Item } from "../../db/items.js";

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
 * Handle /random command.
 * Pick a random item from the database for serendipitous rediscovery.
 */
export async function handleRandom(ctx: Context): Promise<void> {
  try {
    const db = getDb();
    const item = db
      .prepare("SELECT * FROM items ORDER BY RANDOM() LIMIT 1")
      .get() as Item | undefined;

    if (!item) {
      await ctx.reply("📦 まだアイテムがありません。何か保存してみましょう！");
      return;
    }

    const tags = getTagsForItem(item.id);
    const tagsDisplay = tags.length > 0 ? tags.map((t) => `#${t}`).join(" ") : "";

    const typeIcon: Record<string, string> = {
      article: "📄",
      memo: "📝",
      code: "💻",
      idea: "💡",
      reference: "📚",
    };
    const icon = typeIcon[item.type] ?? "📦";

    const lines = [
      "🎲 ランダムアイテム",
      "",
      `${icon} ${item.title || item.summary?.slice(0, 60) || item.content.slice(0, 60)}`,
    ];

    if (item.summary) {
      lines.push(`📝 ${item.summary}`);
    }

    if (item.url) {
      lines.push(`🔗 ${item.url}`);
    }

    if (tagsDisplay) {
      lines.push(`🏷️ ${tagsDisplay}`);
    }

    lines.push(`📅 ${formatDate(item.created_at)}`);
    lines.push(`🆔 ${item.id}`);

    await ctx.reply(lines.join("\n"));

    logger.info({ itemId: item.id }, "Random item displayed");
  } catch (err) {
    logger.error({ err }, "Failed to handle random command");
    await ctx.reply("❌ ランダム表示に失敗しました。もう一度お試しください。");
  }
}
