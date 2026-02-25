import { getDb } from "./database.js";

export interface PageIndex {
  item_id: string;
  tree_json: string;
  page_count: number | null;
  created_at: string;
}

/**
 * Save or replace a PageIndex tree for an item.
 */
export function savePageIndex(
  itemId: string,
  treeJson: object,
  pageCount?: number
): void {
  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO page_indices (item_id, tree_json, page_count)
     VALUES (?, ?, ?)`
  ).run(itemId, JSON.stringify(treeJson), pageCount ?? null);
}

/**
 * Retrieve the PageIndex tree for an item.
 */
export function getPageIndex(itemId: string): PageIndex | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM page_indices WHERE item_id = ?")
    .get(itemId) as PageIndex | undefined;
  return row ?? null;
}

/**
 * Delete the PageIndex tree for an item.
 */
export function deletePageIndex(itemId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM page_indices WHERE item_id = ?").run(itemId);
}

/**
 * Get all item IDs that have a PageIndex.
 */
export function getItemIdsWithPageIndex(): string[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT item_id FROM page_indices")
    .all() as { item_id: string }[];
  return rows.map((r) => r.item_id);
}
