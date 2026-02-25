import type { Context } from "grammy";
import { InputFile } from "grammy";
import { logger } from "../../utils/logger.js";
import { getDb } from "../../db/database.js";
import type { Item } from "../../db/items.js";

interface ExportItem extends Item {
  tags: string[];
}

interface ExportMemoryCategory {
  id: number;
  name: string;
  summary: string | null;
  item_count: number;
  items: {
    id: number;
    type: string;
    content: string;
    source_id: string | null;
    salience: number;
    created_at: string;
  }[];
}

interface ExportData {
  exported_at: string;
  items: ExportItem[];
  memory_categories: ExportMemoryCategory[];
}

/**
 * Handle /export command.
 * Exports all data as a JSON file and sends it as a Telegram document.
 */
export async function handleExport(ctx: Context): Promise<void> {
  const statusMsg = await ctx.reply("⏳ エクスポート中...");

  try {
    const db = getDb();

    // Fetch all items
    const items = db
      .prepare("SELECT * FROM items ORDER BY created_at DESC")
      .all() as Item[];

    // Fetch tags for each item
    const itemTagStmt = db.prepare(
      `SELECT t.name FROM tags t
       JOIN item_tags it ON it.tag_id = t.id
       WHERE it.item_id = ?
       ORDER BY t.name`
    );

    const exportItems: ExportItem[] = items.map((item) => {
      const tags = (itemTagStmt.all(item.id) as { name: string }[]).map(
        (r) => r.name
      );
      return { ...item, tags };
    });

    // Fetch all memory categories with their items
    const categories = db
      .prepare("SELECT * FROM memory_categories ORDER BY name")
      .all() as {
      id: number;
      name: string;
      summary: string | null;
      item_count: number;
    }[];

    const memoryItemStmt = db.prepare(
      `SELECT id, type, content, source_id, salience, created_at
       FROM memory_items
       WHERE category_id = ?
       ORDER BY salience DESC, created_at DESC`
    );

    const exportCategories: ExportMemoryCategory[] = categories.map((cat) => {
      const memItems = memoryItemStmt.all(cat.id) as {
        id: number;
        type: string;
        content: string;
        source_id: string | null;
        salience: number;
        created_at: string;
      }[];
      return { ...cat, items: memItems };
    });

    // Build export object
    const exportData: ExportData = {
      exported_at: new Date().toISOString(),
      items: exportItems,
      memory_categories: exportCategories,
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const buffer = Buffer.from(jsonStr, "utf-8");

    // Send as a document
    await ctx.replyWithDocument(
      new InputFile(buffer, "rekolto-export.json"),
      { caption: `📦 エクスポート完了: ${exportItems.length} アイテム / ${exportCategories.length} カテゴリ` }
    );

    // Clean up the status message
    try {
      await ctx.api.deleteMessage(statusMsg.chat.id, statusMsg.message_id);
    } catch {
      // Ignore if deletion fails
    }

    logger.info(
      { items: exportItems.length, categories: exportCategories.length },
      "Data exported"
    );
  } catch (err) {
    logger.error({ err }, "Failed to handle export command");

    try {
      await ctx.api.editMessageText(
        statusMsg.chat.id,
        statusMsg.message_id,
        "❌ エクスポートに失敗しました。もう一度お試しください。",
      );
    } catch {
      await ctx.reply("❌ エクスポートに失敗しました。もう一度お試しください。");
    }
  }
}
