import { Bot } from "grammy";
import { handleMemo } from "./handlers/memo.js";
import { handleUrl } from "./handlers/url.js";
import { handleSearch } from "./handlers/search.js";
import { handleInsight } from "./handlers/insight.js";
import { handleRandom } from "./handlers/random.js";
import { handleStats } from "./handlers/stats.js";
import { handleDelete } from "./handlers/delete.js";
import { handleExport } from "./handlers/export.js";
import { handleImage } from "./handlers/image.js";
import { handlePdf } from "./handlers/pdf.js";
import { getRecentItems } from "../db/items.js";
import { getAllTags, getItemsByTag } from "../db/tags.js";
import { logger } from "../utils/logger.js";

/** Simple regex to detect URLs in a message. */
const URL_REGEX = /https?:\/\/\S+/;

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

export function registerCommands(bot: Bot): void {
  // /start - Welcome message
  bot.command("start", (ctx) =>
    ctx.reply(
      "Rekolto へようこそ！\n\n" +
        "メモや URL を送ってください。AI が自動で要約・タグ付けして保存します。\n\n" +
        "コマンド一覧:\n" +
        "/search <クエリ> — 検索\n" +
        "/recent — 最近の保存\n" +
        "/tags — タグ一覧\n" +
        "/tag <タグ名> — タグで絞り込み\n" +
        "/insight — 学習した関心・カテゴリ\n" +
        "/random — ランダムに1件表示\n" +
        "/stats — 統計情報\n" +
        "/delete <ID> — アイテム削除\n" +
        "/export — データエクスポート",
    ),
  );

  // /search - Hybrid search (FTS5 + PageIndex + LLM reranking)
  bot.command("search", handleSearch);

  // /insight - Memory insights
  bot.command("insight", handleInsight);

  // /random - Random item for serendipitous rediscovery
  bot.command("random", handleRandom);

  // /stats - Database statistics
  bot.command("stats", handleStats);

  // /delete <ID> - Delete an item
  bot.command("delete", handleDelete);

  // /export - Export all data as JSON file
  bot.command("export", handleExport);

  // /recent - Show recent items
  bot.command("recent", async (ctx) => {
    try {
      const items = getRecentItems(10);

      if (items.length === 0) {
        await ctx.reply("📭 まだ何も保存されていません。メモや URL を送ってみてください！");
        return;
      }

      const lines: string[] = [`📋 最近の保存 (${items.length} 件)`];
      lines.push("");

      for (const item of items) {
        const icon = item.type === "memo" ? "📝" : "📄";
        const date = formatDate(item.created_at);
        const title = item.title || item.summary?.slice(0, 50) || item.content.slice(0, 50);

        lines.push(`${icon} ${title} (${date})`);

        if (item.summary) {
          const summaryLine = item.summary.split("\n")[0].slice(0, 80);
          lines.push(`   → ${summaryLine}`);
        }

        lines.push(`   🆔 ${item.id}`);
        lines.push("");
      }

      await ctx.reply(lines.join("\n"));
    } catch (err) {
      logger.error({ err }, "Failed to handle /recent");
      await ctx.reply("❌ 取得に失敗しました。");
    }
  });

  // /tags - Show all tags with counts
  bot.command("tags", async (ctx) => {
    try {
      const tags = getAllTags();

      if (tags.length === 0) {
        await ctx.reply("🏷️ タグはまだありません。");
        return;
      }

      const lines: string[] = [`🏷️ タグ一覧 (${tags.length} 件)`];
      lines.push("");

      for (const tag of tags) {
        lines.push(`  #${tag.name}  (${tag.count})`);
      }

      await ctx.reply(lines.join("\n"));
    } catch (err) {
      logger.error({ err }, "Failed to handle /tags");
      await ctx.reply("❌ タグの取得に失敗しました。");
    }
  });

  // /tag <name> - Show items for a specific tag
  bot.command("tag", async (ctx) => {
    const text = ctx.message?.text ?? "";
    const tagName = text.replace(/^\/tag\s*/, "").trim();

    if (!tagName) {
      await ctx.reply("使い方: /tag <タグ名>\n例: /tag rust");
      return;
    }

    try {
      const items = getItemsByTag(tagName);

      if (items.length === 0) {
        await ctx.reply(`🔍 タグ「#${tagName}」のアイテムは見つかりませんでした。`);
        return;
      }

      const lines: string[] = [`🏷️ #${tagName}  (${items.length} 件)`];
      lines.push("");

      for (const item of items) {
        const icon = item.type === "memo" ? "📝" : "📄";
        const date = formatDate(item.created_at);
        const title = item.title || item.summary?.slice(0, 50) || item.content.slice(0, 50);

        lines.push(`${icon} ${title} (${date})`);
        lines.push(`   🆔 ${item.id}`);
        lines.push("");
      }

      await ctx.reply(lines.join("\n"));
    } catch (err) {
      logger.error({ err, tagName }, "Failed to handle /tag");
      await ctx.reply("❌ 取得に失敗しました。");
    }
  });

  // Handle photo messages (image OCR via Gemini Vision)
  bot.on("message:photo", handleImage);
  bot.on("message:document", async (ctx) => {
    const doc = ctx.message.document;
    if (doc.mime_type?.startsWith("image/")) {
      await handleImage(ctx);
    } else if (doc.mime_type === "application/pdf") {
      await handlePdf(ctx);
    }
  });

  // Default: handle text messages — detect URL vs plain memo
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;

    // Check for URL
    const urlMatch = text.match(URL_REGEX);
    if (urlMatch) {
      await handleUrl(ctx, urlMatch[0]);
    } else {
      await handleMemo(ctx);
    }
  });
}
