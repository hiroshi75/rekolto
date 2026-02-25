import { Bot } from "grammy";
import { logger } from "../utils/logger.js";
import { handleMemo } from "./handlers/memo.js";
import { handleUrl } from "./handlers/url.js";
import { handleSearch } from "./handlers/search.js";
import { getRecentItems } from "../db/items.js";
import { getAllTags, getItemsByTag } from "../db/tags.js";

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
        "/tag <タグ名> — タグで絞り込み",
    ),
  );

  // /search - Full-text search
  bot.command("search", handleSearch);

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

  // Stubs for future phases
  bot.command("random", (ctx) => ctx.reply("🚧 準備中..."));
  bot.command("stats", (ctx) => ctx.reply("🚧 準備中..."));
  bot.command("delete", (ctx) => ctx.reply("🚧 準備中..."));
  bot.command("export", (ctx) => ctx.reply("🚧 準備中..."));

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
