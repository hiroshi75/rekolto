import { getDb } from "./database.js";
import type { Item } from "./items.js";
import type { MemoryItem } from "./memory-store.js";

export function syncItemToFts(item: {
  id: string;
  title?: string;
  content: string;
  summary?: string;
}): void {
  const db = getDb();

  // Remove existing entry, then insert
  db.prepare("DELETE FROM items_fts WHERE item_id = ?").run(item.id);
  db.prepare(
    "INSERT INTO items_fts (item_id, title, content, summary) VALUES (?, ?, ?, ?)"
  ).run(item.id, item.title ?? null, item.content, item.summary ?? null);
}

export function removeItemFromFts(itemId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM items_fts WHERE item_id = ?").run(itemId);
}

export function searchItems(query: string, limit = 20): Item[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT i.*, bm25(items_fts) AS rank
       FROM items_fts fts
       JOIN items i ON i.id = fts.item_id
       WHERE items_fts MATCH ?
       ORDER BY rank
       LIMIT ?`
    )
    .all(query, limit) as Item[];
}

export function syncMemoryItemToFts(memoryItem: {
  id: number;
  content: string;
}): void {
  const db = getDb();

  db.prepare("DELETE FROM memory_items_fts WHERE memory_item_id = ?").run(memoryItem.id);
  db.prepare(
    "INSERT INTO memory_items_fts (memory_item_id, content) VALUES (?, ?)"
  ).run(memoryItem.id, memoryItem.content);
}

export function searchMemoryItems(query: string, limit = 20): MemoryItem[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT mi.*, bm25(memory_items_fts) AS rank
       FROM memory_items_fts fts
       JOIN memory_items mi ON mi.id = fts.memory_item_id
       WHERE memory_items_fts MATCH ?
       ORDER BY rank
       LIMIT ?`
    )
    .all(query, limit) as MemoryItem[];
}
