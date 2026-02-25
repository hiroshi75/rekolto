import { getDb } from "../db/database.js";
import { logger } from "../utils/logger.js";

/**
 * Record a search query and its result IDs to the search_history table.
 *
 * @param query The search query string.
 * @param resultIds Array of item IDs returned by the search.
 */
export function recordSearch(query: string, resultIds: string[]): void {
  try {
    const db = getDb();
    const resultsJson = JSON.stringify(resultIds);

    db.prepare(
      "INSERT INTO search_history (query, results) VALUES (?, ?)"
    ).run(query, resultsJson);

    logger.debug({ query, resultCount: resultIds.length }, "Search recorded");
  } catch (err) {
    logger.error({ err, query }, "Failed to record search");
  }
}

/**
 * Get recent search history entries.
 *
 * @param limit Maximum number of entries to return (default 20).
 */
export function getRecentSearches(
  limit = 20
): Array<{ query: string; created_at: string }> {
  try {
    const db = getDb();
    return db
      .prepare(
        "SELECT query, created_at FROM search_history ORDER BY created_at DESC LIMIT ?"
      )
      .all(limit) as Array<{ query: string; created_at: string }>;
  } catch (err) {
    logger.error({ err }, "Failed to get recent searches");
    return [];
  }
}
