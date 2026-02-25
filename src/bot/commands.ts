import { Bot } from "grammy";

export function registerCommands(bot: Bot): void {
  bot.command("start", (ctx) =>
    ctx.reply("Rekolto へようこそ！メモや URL を送ってください。"),
  );

  bot.command("recent", (ctx) => ctx.reply("🚧 準備中..."));
  bot.command("search", (ctx) => ctx.reply("🚧 準備中..."));
  bot.command("tags", (ctx) => ctx.reply("🚧 準備中..."));
  bot.command("tag", (ctx) => ctx.reply("🚧 準備中..."));
  bot.command("random", (ctx) => ctx.reply("🚧 準備中..."));
  bot.command("stats", (ctx) => ctx.reply("🚧 準備中..."));
  bot.command("delete", (ctx) => ctx.reply("🚧 準備中..."));
  bot.command("export", (ctx) => ctx.reply("🚧 準備中..."));

  // Default: treat as memo
  bot.on("message:text", (ctx) =>
    ctx.reply(`📝 受信: "${ctx.message.text}"\n🚧 保存機能は準備中...`),
  );
}
