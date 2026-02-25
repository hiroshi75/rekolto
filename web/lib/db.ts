import Database from "better-sqlite3";
import path from "node:path";
import type { Item, Tag, MemoryCategory, MemoryItem, Stats } from "./types";

const DB_PATH = path.resolve(process.cwd(), "../data/rekolto.db");

let _migrated = false;

function runWebMigrations(): void {
  if (_migrated) return;
  _migrated = true;
  const db = getWriteDb();
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id         TEXT PRIMARY KEY,
        title      TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    try {
      db.exec(`ALTER TABLE search_history ADD COLUMN session_id TEXT REFERENCES chat_sessions(id) ON DELETE CASCADE`);
    } catch {
      // column already exists
    }
  } finally {
    db.close();
  }
}

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  runWebMigrations();
  if (!_db) {
    _db = new Database(DB_PATH, { readonly: true });
    _db.pragma("journal_mode = WAL");
  }
  return _db;
}

export function getWriteDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

// --- Items ---

export function getItem(id: string): Item | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM items WHERE id = ?").get(id) as Item | undefined;
  return row ?? null;
}

export function getRecentItems(limit = 20): Item[] {
  const db = getDb();
  return db.prepare("SELECT * FROM items ORDER BY created_at DESC LIMIT ?").all(limit) as Item[];
}

export function deleteItem(id: string): void {
  const db = getWriteDb();
  try {
    db.prepare("DELETE FROM items_fts WHERE item_id = ?").run(id);
    db.prepare("DELETE FROM item_tags WHERE item_id = ?").run(id);
    db.prepare("DELETE FROM items WHERE id = ?").run(id);
  } finally {
    db.close();
  }
  // Reset the read-only connection so it picks up the change
  if (_db) {
    _db.close();
    _db = null;
  }
}

// --- Search ---

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

// --- Tags ---

export function getAllTags(): Tag[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT t.name, COUNT(it.item_id) AS count
       FROM tags t
       LEFT JOIN item_tags it ON it.tag_id = t.id
       GROUP BY t.id
       ORDER BY count DESC, t.name`
    )
    .all() as Tag[];
}

export function getTagsForItem(itemId: string): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT t.name FROM tags t
       JOIN item_tags it ON it.tag_id = t.id
       WHERE it.item_id = ?
       ORDER BY t.name`
    )
    .all(itemId) as { name: string }[];
  return rows.map((r) => r.name);
}

export function getItemsByTag(tagName: string): Item[] {
  const db = getDb();
  const normalized = tagName.trim().toLowerCase();
  return db
    .prepare(
      `SELECT i.* FROM items i
       JOIN item_tags it ON it.item_id = i.id
       JOIN tags t ON t.id = it.tag_id
       WHERE t.name = ?
       ORDER BY i.created_at DESC`
    )
    .all(normalized) as Item[];
}

// --- Memory ---

export function getAllCategories(): MemoryCategory[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM memory_categories ORDER BY name")
    .all() as MemoryCategory[];
}

export function getMemoryItemsByCategory(categoryId: number): MemoryItem[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM memory_items WHERE category_id = ? ORDER BY salience DESC, created_at DESC"
    )
    .all(categoryId) as MemoryItem[];
}

export function getTopSalientItems(limit = 20): MemoryItem[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM memory_items ORDER BY salience DESC, access_count DESC LIMIT ?"
    )
    .all(limit) as MemoryItem[];
}

export function getRecentInterests(limit = 10): { query: string; created_at: string }[] {
  const db = getDb();
  return db
    .prepare("SELECT query, created_at FROM search_history ORDER BY created_at DESC LIMIT ?")
    .all(limit) as { query: string; created_at: string }[];
}

// --- Insight helpers ---

export function getRediscoverItems(limit = 3): (MemoryItem & { category_name: string })[] {
  const db = getDb();
  // High salience items created more than 7 days ago, pseudo-random order
  return db
    .prepare(
      `SELECT mi.*, mc.name AS category_name
       FROM memory_items mi
       JOIN memory_categories mc ON mc.id = mi.category_id
       WHERE mi.created_at < datetime('now', '-7 days')
       ORDER BY (mi.salience * 0.7 + RANDOM() * 0.0000000001) DESC
       LIMIT ?`
    )
    .all(limit) as (MemoryItem & { category_name: string })[];
}

export function getThisWeekActivity(): { itemsAdded: number; searchCount: number } {
  const db = getDb();
  const itemsAdded = (
    db.prepare("SELECT COUNT(*) as c FROM items WHERE created_at > datetime('now', '-7 days')").get() as { c: number }
  ).c;
  const searchCount = (
    db.prepare("SELECT COUNT(*) as c FROM search_history WHERE created_at > datetime('now', '-7 days')").get() as { c: number }
  ).c;
  return { itemsAdded, searchCount };
}

// --- Stats ---

export function getStats(): Stats {
  const db = getDb();

  const totalItems = (db.prepare("SELECT COUNT(*) as c FROM items").get() as { c: number }).c;
  const totalTags = (db.prepare("SELECT COUNT(*) as c FROM tags").get() as { c: number }).c;
  const totalMemoryItems = (db.prepare("SELECT COUNT(*) as c FROM memory_items").get() as { c: number }).c;
  const totalCategories = (db.prepare("SELECT COUNT(*) as c FROM memory_categories").get() as { c: number }).c;

  const itemsByType = db
    .prepare("SELECT type, COUNT(*) as count FROM items GROUP BY type ORDER BY count DESC")
    .all() as { type: string; count: number }[];

  const recentItems = (
    db
      .prepare("SELECT COUNT(*) as c FROM items WHERE created_at > datetime('now', '-7 days')")
      .get() as { c: number }
  ).c;

  return { totalItems, totalTags, totalMemoryItems, totalCategories, itemsByType, recentItems };
}
