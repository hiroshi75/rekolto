import { getDb } from "./database.js";
import { syncMemoryItemToFts } from "./fts.js";

export interface MemoryCategory {
  id: number;
  name: string;
  summary: string | null;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface MemoryItem {
  id: number;
  category_id: number;
  type: string;
  content: string;
  source_id: string | null;
  salience: number;
  access_count: number;
  last_accessed: string | null;
  created_at: string;
}

export function findOrCreateCategory(name: string): MemoryCategory {
  const db = getDb();
  const normalized = name.trim().toLowerCase();

  db.prepare("INSERT OR IGNORE INTO memory_categories (name) VALUES (?)").run(normalized);

  return db
    .prepare("SELECT * FROM memory_categories WHERE name = ?")
    .get(normalized) as MemoryCategory;
}

export function createMemoryItem(data: {
  category_id: number;
  type: string;
  content: string;
  source_id?: string;
}): MemoryItem {
  const db = getDb();

  const result = db
    .prepare(
      `INSERT INTO memory_items (category_id, type, content, source_id)
       VALUES (?, ?, ?, ?)`
    )
    .run(data.category_id, data.type, data.content, data.source_id ?? null);

  // Update item_count on the category
  db.prepare(
    "UPDATE memory_categories SET item_count = item_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(data.category_id);

  const item = db
    .prepare("SELECT * FROM memory_items WHERE id = ?")
    .get(result.lastInsertRowid) as MemoryItem;

  syncMemoryItemToFts({ id: item.id, content: item.content });

  return item;
}

export function getMemoryItemsByCategory(categoryId: number): MemoryItem[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM memory_items WHERE category_id = ? ORDER BY salience DESC, created_at DESC"
    )
    .all(categoryId) as MemoryItem[];
}

export function updateSalience(id: number, salience: number, accessCount: number): void {
  const db = getDb();
  db.prepare(
    `UPDATE memory_items
     SET salience = ?, access_count = ?, last_accessed = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(salience, accessCount, id);
}

export function getAllCategories(): MemoryCategory[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM memory_categories ORDER BY name")
    .all() as MemoryCategory[];
}
