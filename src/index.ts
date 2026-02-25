import "dotenv/config";
import { createBot } from "./bot/bot.js";
import { initDatabase } from "./db/database.js";
import { startBrowserRelay } from "./services/browser-relay.js";
import { logger } from "./utils/logger.js";

async function main() {
  logger.info("Starting Rekolto...");

  // Initialize SQLite database
  initDatabase();

  // Start browser relay WS server (if enabled in config)
  startBrowserRelay();

  // Start Telegram bot
  const bot = createBot();
  await bot.start({
    onStart: () => logger.info("Rekolto bot is running"),
  });
}

main().catch((err) => {
  logger.error(err, "Fatal error");
  process.exit(1);
});
