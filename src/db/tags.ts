import { getDb } from "./database.js";
import type { Item } from "./items.js";

export function findOrCreateTag(name: string): { id: number; name: string } {
  const db = getDb();
  const normalized = name.trim().toLowerCase();

  db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)").run(normalized);

  const tag = db
    .prepare("SELECT id, name FROM tags WHERE name = ?")
    .get(normalized) as { id: number; name: string };

  return tag;
}

export function addTagsToItem(itemId: string, tagNames: string[]): void {
  const db = getDb();
  const insertStmt = db.prepare(
    "INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)"
  );

  for (const name of tagNames) {
    const tag = findOrCreateTag(name);
    insertStmt.run(itemId, tag.id);
  }
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

export function getAllTags(): { name: string; count: number }[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT t.name, COUNT(it.item_id) AS count
       FROM tags t
       LEFT JOIN item_tags it ON it.tag_id = t.id
       GROUP BY t.id
       ORDER BY count DESC, t.name`
    )
    .all() as { name: string; count: number }[];
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
