import { getDb } from "../db/database.js";
import type { MemoryItem } from "../db/memory-store.js";
import { searchMemoryItems } from "../db/fts.js";
import { boostSalience } from "./salience.js";
import { logger } from "../utils/logger.js";

/**
 * Search memory items using FTS5, sorted by a combined score of
 * FTS rank and salience weight. Boosts salience on accessed items.
 *
 * @param query FTS5 search query string.
 * @param limit Maximum number of results to return (default 10).
 */
export function retrieveRelated(query: string, limit = 10): MemoryItem[] {
  try {
    const db = getDb();

    // Query FTS with salience weighting:
    // bm25() returns negative values (more negative = better match),
    // so we use (bm25 * -1) * (1 + salience) for combined scoring.
    const results = db
      .prepare(
        `SELECT mi.*, bm25(memory_items_fts) AS rank
         FROM memory_items_fts fts
         JOIN memory_items mi ON mi.id = fts.memory_item_id
         WHERE memory_items_fts MATCH ?
         ORDER BY (bm25(memory_items_fts) * -1) * (1.0 + mi.salience) DESC
         LIMIT ?`
      )
      .all(query, limit) as MemoryItem[];

    // Boost salience for each accessed item
    for (const item of results) {
      boostSalience(item.id);
    }

    logger.debug(
      { query, resultCount: results.length },
      "Retrieved related memory items"
    );

    return results;
  } catch (err) {
    logger.error({ err, query }, "Failed to retrieve related memory items");
    return [];
  }
}

/**
 * Analyze recent search history and memory access patterns to identify
 * current interest topics.
 *
 * Uses a simple approach: returns the most frequently accessed categories
 * based on memory item access counts and recent search history.
 *
 * @param limit Maximum number of interest topics to return (default 5).
 */
export function getRecentInterests(limit = 5): string[] {
  try {
    const db = getDb();

    // Get categories ordered by total access count of their items
    const categoryInterests = db
      .prepare(
        `SELECT mc.name, SUM(mi.access_count) AS total_access
         FROM memory_items mi
         JOIN memory_categories mc ON mc.id = mi.category_id
         WHERE mi.access_count > 0
         GROUP BY mc.id
         ORDER BY total_access DESC
         LIMIT ?`
      )
      .all(limit) as Array<{ name: string; total_access: number }>;

    const interests = categoryInterests.map((row) => row.name);

    // If we have fewer interests than the limit, supplement with recent search queries
    if (interests.length < limit) {
      const remaining = limit - interests.length;
      const recentSearches = db
        .prepare(
          `SELECT DISTINCT query FROM search_history
           ORDER BY created_at DESC
           LIMIT ?`
        )
        .all(remaining) as Array<{ query: string }>;

      for (const search of recentSearches) {
        if (!interests.includes(search.query)) {
          interests.push(search.query);
        }
      }
    }

    logger.debug({ interests }, "Recent interests identified");

    return interests.slice(0, limit);
  } catch (err) {
    logger.error({ err }, "Failed to get recent interests");
    return [];
  }
}
