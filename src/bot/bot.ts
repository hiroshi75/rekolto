import { Bot } from "grammy";
import { loadConfig } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import { registerCommands } from "./commands.js";

export function createBot(): Bot {
  const config = loadConfig();
  const bot = new Bot(config.telegram.bot_token);

  // Global error handler
  bot.catch((err) => {
    const ctx = err.ctx;
    const e = err.error;

    logger.error(
      {
        error: e,
        update_id: ctx.update.update_id,
        chat_id: ctx.chat?.id,
      },
      "Unhandled bot error",
    );

    // Try to notify the user
    ctx.reply("❌ 予期しないエラーが発生しました。もう一度お試しください。").catch(() => {
      // Ignore reply failure
    });
  });

  // Restrict to allowed users (if configured)
  if (config.telegram.allowed_users.length > 0) {
    bot.use(async (ctx, next) => {
      const userId = ctx.from?.id;
      if (userId && config.telegram.allowed_users.includes(userId)) {
        await next();
      }
    });
  }

  registerCommands(bot);

  return bot;
}
