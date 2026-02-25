import { getDb } from "./database.js";
import { generateId } from "../utils/id.js";
import { syncItemToFts, removeItemFromFts } from "./fts.js";

export interface Item {
  id: string;
  type: string;
  title: string | null;
  url: string | null;
  content: string;
  summary: string | null;
  og_image: string | null;
  created_at: string;
  updated_at: string;
}

export function createItem(data: {
  type: string;
  title?: string;
  url?: string;
  content: string;
  summary?: string;
  og_image?: string;
}): Item {
  const db = getDb();
  const id = generateId();

  db.prepare(
    `INSERT INTO items (id, type, title, url, content, summary, og_image)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.type,
    data.title ?? null,
    data.url ?? null,
    data.content,
    data.summary ?? null,
    data.og_image ?? null
  );

  const item = getItem(id)!;

  syncItemToFts({
    id: item.id,
    title: item.title ?? undefined,
    content: item.content,
    summary: item.summary ?? undefined,
  });

  return item;
}

export function getItem(id: string): Item | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM items WHERE id = ?").get(id) as Item | undefined;
  return row ?? null;
}

export function getRecentItems(limit = 10): Item[] {
  const db = getDb();
  return db.prepare("SELECT * FROM items ORDER BY created_at DESC LIMIT ?").all(limit) as Item[];
}

export function deleteItem(id: string): void {
  const db = getDb();

  removeItemFromFts(id);

  // item_tags are deleted via ON DELETE CASCADE, but since the FK is on item_id
  // referencing items(id), we delete explicitly to be safe
  db.prepare("DELETE FROM item_tags WHERE item_id = ?").run(id);
  db.prepare("DELETE FROM items WHERE id = ?").run(id);
}
