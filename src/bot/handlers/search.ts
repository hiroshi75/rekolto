import type { Context } from "grammy";
import { logger } from "../../utils/logger.js";
import { hybridSearch } from "../../services/hybrid-search.js";
import { recordSearch } from "../../services/search-history.js";
import { getProactiveSuggestions } from "../../memory/proactive.js";

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
 * Performs 3-layer hybrid search (FTS5 + PageIndex + LLM reranking),
 * records search history, and shows proactive suggestions.
 */
export async function handleSearch(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? "";
  const query = text.replace(/^\/search\s*/, "").trim();

  if (!query) {
    await ctx.reply("使い方: /search <検索クエリ>\n例: /search RAG チャンク分割");
    return;
  }

  try {
    // 3-layer hybrid search
    const result = await hybridSearch(query);

    if (result.items.length === 0 && result.memorySuggestions.length === 0) {
      await ctx.reply("🔍 見つかりませんでした");
      return;
    }

    // Record search history
    recordSearch(
      query,
      result.items.map((r) => r.item.id)
    );

    const lines: string[] = [];

    if (result.items.length > 0) {
      lines.push(`🔍 ${result.items.length} 件見つかりました`);
      lines.push("");

      for (let i = 0; i < result.items.length; i++) {
        const entry = result.items[i];
        const item = entry.item;
        const icon = item.type === "memo" ? "📝" : "📄";
        const date = formatDate(item.created_at);
        const title =
          item.title ||
          item.summary?.slice(0, 50) ||
          item.content.slice(0, 50);

        // Show source badge
        const sourceBadge =
          entry.source === "pageindex" ? " [PageIndex]" : " [FTS5]";

        lines.push(`${i + 1}. ${icon} ${title} (${date})${sourceBadge}`);

        if (entry.source === "pageindex" && entry.section) {
          // Show matched section path/content for PageIndex results
          const sectionLines = entry.section.split("\n");
          for (const sectionLine of sectionLines.slice(0, 2)) {
            lines.push(`   📑 ${sectionLine.slice(0, 120)}`);
          }
        } else if (item.summary) {
          // Show first line of summary for FTS results
          const summaryLine = item.summary.split("\n")[0].slice(0, 100);
          lines.push(`   → ${summaryLine}`);
        }

        lines.push(`   🆔 ${item.id}`);
        lines.push("");
      }
    }

    if (result.memorySuggestions.length > 0) {
      lines.push(`🧠 関連する記憶: ${result.memorySuggestions.length} 件`);
      lines.push("");

      for (const suggestion of result.memorySuggestions) {
        lines.push(`  • ${suggestion}`);
      }
      lines.push("");
    }

    await ctx.reply(lines.join("\n"));

    // Proactive suggestions (non-blocking, sent as a separate message)
    getProactiveSuggestions({ query })
      .then(async (suggestions) => {
        if (suggestions.length > 0) {
          const sugLines = ["💡 関連する提案:"];
          for (const s of suggestions) {
            sugLines.push(`  • ${s}`);
          }
          await ctx.reply(sugLines.join("\n")).catch(() => {});
        }
      })
      .catch(() => {});

    logger.info(
      {
        query,
        itemCount: result.items.length,
        memoryCount: result.memorySuggestions.length,
        pageIndexHits: result.items.filter((r) => r.source === "pageindex")
          .length,
      },
      "Hybrid search completed"
    );
  } catch (err) {
    logger.error({ err, query }, "Failed to handle search");
    await ctx.reply("❌ 検索に失敗しました。もう一度お試しください。");
  }
}
