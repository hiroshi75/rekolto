import Database from "better-sqlite3";
import { loadConfig } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) throw new Error("Database not initialized. Call initDatabase() first.");
  return _db;
}

export function initDatabase(): void {
  const config = loadConfig();
  const dbPath = config.database.path;

  // Ensure data directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  runMigrations(_db);
  logger.info({ path: dbPath }, "Database initialized");
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    -- メインのアイテムテーブル
    CREATE TABLE IF NOT EXISTS items (
      id          TEXT PRIMARY KEY,
      type        TEXT NOT NULL,
      title       TEXT,
      url         TEXT,
      content     TEXT NOT NULL,
      summary     TEXT,
      og_image    TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- タグテーブル
    CREATE TABLE IF NOT EXISTS tags (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS item_tags (
      item_id  TEXT REFERENCES items(id) ON DELETE CASCADE,
      tag_id   INTEGER REFERENCES tags(id),
      PRIMARY KEY (item_id, tag_id)
    );

    -- PageIndex ツリーインデックス
    CREATE TABLE IF NOT EXISTS page_indices (
      item_id    TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
      tree_json  TEXT NOT NULL,
      page_count INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- メモリカテゴリ
    CREATE TABLE IF NOT EXISTS memory_categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT UNIQUE NOT NULL,
      summary     TEXT,
      item_count  INTEGER DEFAULT 0,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- メモリアイテム
    CREATE TABLE IF NOT EXISTS memory_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id  INTEGER REFERENCES memory_categories(id),
      type         TEXT NOT NULL,
      content      TEXT NOT NULL,
      source_id    TEXT REFERENCES items(id),
      salience     REAL DEFAULT 0.0,
      access_count INTEGER DEFAULT 0,
      last_accessed DATETIME,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 検索履歴
    CREATE TABLE IF NOT EXISTS search_history (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      query      TEXT NOT NULL,
      results    TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Xクローラー設定
    CREATE TABLE IF NOT EXISTS x_crawler_settings (
      id                  INTEGER PRIMARY KEY CHECK (id = 1),
      enabled             INTEGER NOT NULL DEFAULT 0,
      timezone            TEXT NOT NULL DEFAULT 'UTC',
      scheduled_times     TEXT NOT NULL DEFAULT '[]',
      max_items_per_crawl INTEGER NOT NULL DEFAULT 10,
      updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT OR IGNORE INTO x_crawler_settings (id) VALUES (1);
  `);

  // FTS5 仮想テーブル（スタンドアロン、item_id は UNINDEXED で検索対象外）
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
      title, content, summary,
      item_id UNINDEXED
    );
  `);

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_items_fts USING fts5(
      content,
      memory_item_id UNINDEXED
    );
  `);
}
