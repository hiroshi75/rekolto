import { Bot } from "grammy";
import { loadConfig } from "../utils/config.js";
import { registerCommands } from "./commands.js";

export function createBot(): Bot {
  const config = loadConfig();
  const bot = new Bot(config.telegram.bot_token);

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
