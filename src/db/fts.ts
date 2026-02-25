import { getDb } from "./database.js";
import type { Item } from "./items.js";
import type { MemoryItem } from "./memory-store.js";

export function syncItemToFts(item: {
  rowid?: number;
  id: string;
  title?: string;
  content: string;
  summary?: string;
}): void {
  const db = getDb();

  // Get the rowid from the items table
  const row = db.prepare("SELECT rowid FROM items WHERE id = ?").get(item.id) as
    | { rowid: number }
    | undefined;
  if (!row) return;

  const rowid = row.rowid;

  // Remove existing FTS entry first, then insert
  db.prepare("DELETE FROM items_fts WHERE rowid = ?").run(rowid);
  db.prepare(
    "INSERT INTO items_fts (rowid, title, content, summary) VALUES (?, ?, ?, ?)"
  ).run(rowid, item.title ?? null, item.content, item.summary ?? null);
}

export function removeItemFromFts(itemId: string): void {
  const db = getDb();

  const row = db.prepare("SELECT rowid FROM items WHERE id = ?").get(itemId) as
    | { rowid: number }
    | undefined;
  if (!row) return;

  db.prepare("DELETE FROM items_fts WHERE rowid = ?").run(row.rowid);
}

export function searchItems(query: string, limit = 20): Item[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT i.*, bm25(items_fts) AS rank
       FROM items_fts fts
       JOIN items i ON i.rowid = fts.rowid
       WHERE items_fts MATCH ?
       ORDER BY rank
       LIMIT ?`
    )
    .all(query, limit) as Item[];
}

export function syncMemoryItemToFts(memoryItem: {
  rowid?: number;
  id: number;
  content: string;
}): void {
  const db = getDb();

  // For memory_items the id IS the rowid (INTEGER PRIMARY KEY)
  const rowid = memoryItem.rowid ?? memoryItem.id;

  db.prepare("DELETE FROM memory_items_fts WHERE rowid = ?").run(rowid);
  db.prepare(
    "INSERT INTO memory_items_fts (rowid, content) VALUES (?, ?)"
  ).run(rowid, memoryItem.content);
}

export function searchMemoryItems(query: string, limit = 20): MemoryItem[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT mi.*, bm25(memory_items_fts) AS rank
       FROM memory_items_fts fts
       JOIN memory_items mi ON mi.rowid = fts.rowid
       WHERE memory_items_fts MATCH ?
       ORDER BY rank
       LIMIT ?`
    )
    .all(query, limit) as MemoryItem[];
}
