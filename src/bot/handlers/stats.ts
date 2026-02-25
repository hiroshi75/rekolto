import type { Context } from "grammy";
import { logger } from "../../utils/logger.js";
import { getDb } from "../../db/database.js";

/**
 * Handle /stats command.
 * Show comprehensive statistics about the Rekolto knowledge base.
 */
export async function handleStats(ctx: Context): Promise<void> {
  try {
    const db = getDb();

    // Total items
    const totalItems = (
      db.prepare("SELECT COUNT(*) AS cnt FROM items").get() as { cnt: number }
    ).cnt;

    // Items by type
    const typeCounts = db
      .prepare(
        "SELECT type, COUNT(*) AS cnt FROM items GROUP BY type ORDER BY cnt DESC"
      )
      .all() as { type: string; cnt: number }[];

    // Total distinct tags
    const totalTags = (
      db.prepare("SELECT COUNT(*) AS cnt FROM tags").get() as { cnt: number }
    ).cnt;

    // Top 5 tags
    const topTags = db
      .prepare(
        `SELECT t.name, COUNT(it.item_id) AS cnt
         FROM tags t
         JOIN item_tags it ON it.tag_id = t.id
         GROUP BY t.id
         ORDER BY cnt DESC
         LIMIT 5`
      )
      .all() as { name: string; cnt: number }[];

    // Memory facts count
    const totalMemoryFacts = (
      db.prepare("SELECT COUNT(*) AS cnt FROM memory_items").get() as { cnt: number }
    ).cnt;

    // Memory categories count
    const totalCategories = (
      db.prepare("SELECT COUNT(*) AS cnt FROM memory_categories").get() as {
        cnt: number;
      }
    ).cnt;

    // Items this week (last 7 days)
    const thisWeek = (
      db
        .prepare(
          "SELECT COUNT(*) AS cnt FROM items WHERE created_at >= datetime('now', '-7 days')"
        )
        .get() as { cnt: number }
    ).cnt;

    // Items this month (last 30 days)
    const thisMonth = (
      db
        .prepare(
          "SELECT COUNT(*) AS cnt FROM items WHERE created_at >= datetime('now', '-30 days')"
        )
        .get() as { cnt: number }
    ).cnt;

    // --- Format output ---

    const typeIcons: Record<string, string> = {
      article: "📄",
      memo: "📝",
      code: "💻",
      idea: "💡",
      reference: "📚",
    };

    const typeDisplay = typeCounts
      .map((t) => `${typeIcons[t.type] ?? "📦"} ${t.type}: ${t.cnt}`)
      .join(" | ");

    const topTagsDisplay =
      topTags.length > 0
        ? topTags.map((t) => `#${t.name} (${t.cnt})`).join(" ")
        : "なし";

    const lines = [
      "📊 Rekolto 統計",
      "",
      `📦 アイテム: ${totalItems} 件`,
    ];

    if (typeDisplay) {
      lines.push(`  ${typeDisplay}`);
    }

    lines.push("");
    lines.push(`🏷️ タグ: ${totalTags} 種類`);
    lines.push(`  Top: ${topTagsDisplay}`);
    lines.push("");
    lines.push(`🧠 メモリ: ${totalMemoryFacts} ファクト / ${totalCategories} カテゴリ`);
    lines.push("");
    lines.push(`📅 今週: ${thisWeek} 件 | 今月: ${thisMonth} 件`);

    await ctx.reply(lines.join("\n"));

    logger.info({ totalItems, totalTags, totalMemoryFacts }, "Stats displayed");
  } catch (err) {
    logger.error({ err }, "Failed to handle stats command");
    await ctx.reply("❌ 統計の取得に失敗しました。もう一度お試しください。");
  }
}
