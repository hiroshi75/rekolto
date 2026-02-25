import type { Context } from "grammy";
import { logger } from "../../utils/logger.js";
import { getItem, deleteItem } from "../../db/items.js";

/**
 * Handle /delete <id> command.
 * Deletes the specified item from the database.
 */
export async function handleDelete(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? "";
  const itemId = text.replace(/^\/delete\s*/, "").trim();

  if (!itemId) {
    await ctx.reply("使い方: /delete <id>\n例: /delete rklt_a1b2");
    return;
  }

  try {
    const item = getItem(itemId);

    if (!item) {
      await ctx.reply(`⚠️ アイテムが見つかりません: ${itemId}`);
      return;
    }

    // Show what will be deleted
    const title = item.title || item.summary?.slice(0, 60) || item.content.slice(0, 60);

    // Delete the item
    deleteItem(itemId);

    await ctx.reply(`🗑️ 削除しました: ${title}\n🆔 ${itemId}`);

    logger.info({ itemId, title }, "Item deleted");
  } catch (err) {
    logger.error({ err, itemId }, "Failed to handle delete command");
    await ctx.reply("❌ 削除に失敗しました。もう一度お試しください。");
  }
}
