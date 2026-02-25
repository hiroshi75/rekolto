import type { Context } from "grammy";
import { logger } from "../../utils/logger.js";
import { getAllCategories } from "../../db/memory-store.js";
import { getTopSalientItems } from "../../memory/salience.js";
import { getRecentInterests } from "../../memory/retrieve.js";

/**
 * Handle /insight command.
 * Shows what the memory layer has learned about the user's interests:
 *   - Top categories with item counts
 *   - Most salient (frequently accessed) knowledge
 *   - Recent interest trends
 */
export async function handleInsight(ctx: Context): Promise<void> {
  try {
    const lines: string[] = [];

    lines.push("🧠 Rekolto が学習したあなたの関心");
    lines.push("");

    // --- Top categories ---
    const categories = getAllCategories();
    const sortedCategories = [...categories]
      .sort((a, b) => b.item_count - a.item_count)
      .slice(0, 10);

    lines.push("📊 トップカテゴリ:");

    if (sortedCategories.length === 0) {
      lines.push("  まだカテゴリがありません。");
    } else {
      for (let i = 0; i < sortedCategories.length; i++) {
        const cat = sortedCategories[i];
        lines.push(`  ${i + 1}. ${cat.name} (${cat.item_count}件)`);
      }
    }

    lines.push("");

    // --- Most salient items ---
    const topItems = getTopSalientItems(5);

    lines.push("🔥 よくアクセスする知識:");

    if (topItems.length === 0) {
      lines.push("  まだアクセス履歴がありません。");
    } else {
      for (const item of topItems) {
        const contentPreview = item.content.length > 60
          ? item.content.slice(0, 60) + "..."
          : item.content;
        lines.push(`  • ${contentPreview} (salience: ${item.salience.toFixed(2)})`);
      }
    }

    lines.push("");

    // --- Recent interests ---
    const interests = getRecentInterests(5);

    lines.push("📈 最近の関心:");

    if (interests.length === 0) {
      lines.push("  まだ十分なデータがありません。");
    } else {
      lines.push("  " + interests.join(", "));
    }

    await ctx.reply(lines.join("\n"));

    logger.info(
      {
        categoryCount: categories.length,
        topItemCount: topItems.length,
        interestCount: interests.length,
      },
      "/insight command handled"
    );
  } catch (err) {
    logger.error({ err }, "Failed to handle /insight");
    await ctx.reply("❌ インサイトの取得に失敗しました。");
  }
}
