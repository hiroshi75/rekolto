import { getDb } from "../db/database.js";
import { updateSalience } from "../db/memory-store.js";
import type { MemoryItem } from "../db/memory-store.js";
import { loadConfig } from "../utils/config.js";
import { logger } from "../utils/logger.js";

/**
 * Boost salience for a memory item when it is accessed (e.g., via search).
 * Increases salience by config.memory.salience.access_boost, increments access_count,
 * and sets last_accessed via updateSalience.
 */
export function boostSalience(memoryItemId: number): void {
  try {
    const config = loadConfig();
    const boost = config.memory.salience.access_boost;
    const db = getDb();

    const item = db
      .prepare("SELECT id, salience, access_count FROM memory_items WHERE id = ?")
      .get(memoryItemId) as Pick<MemoryItem, "id" | "salience" | "access_count"> | undefined;

    if (!item) {
      logger.warn({ memoryItemId }, "Memory item not found for salience boost");
      return;
    }

    const newSalience = Math.min(1.0, item.salience + boost);
    const newAccessCount = item.access_count + 1;

    updateSalience(item.id, newSalience, newAccessCount);

    logger.debug(
      { memoryItemId, oldSalience: item.salience, newSalience, accessCount: newAccessCount },
      "Salience boosted"
    );
  } catch (err) {
    logger.error({ err, memoryItemId }, "Failed to boost salience");
  }
}

/**
 * Decay all salience scores by multiplying with (1 - decay_rate).
 * Intended to be called periodically (e.g., daily).
 */
export function decayAllSalience(): void {
  try {
    const config = loadConfig();
    const decayRate = config.memory.salience.decay_rate;
    const factor = 1 - decayRate;

    const db = getDb();
    const result = db
      .prepare("UPDATE memory_items SET salience = salience * ? WHERE salience > 0")
      .run(factor);

    logger.info(
      { decayRate, factor, affectedRows: result.changes },
      "Salience decay applied to all memory items"
    );
  } catch (err) {
    logger.error({ err }, "Failed to decay salience");
  }
}

/**
 * Return the top memory items sorted by salience score (descending).
 * @param limit Maximum number of items to return (default 10).
 */
export function getTopSalientItems(limit = 10): MemoryItem[] {
  try {
    const db = getDb();
    return db
      .prepare(
        "SELECT * FROM memory_items WHERE salience > 0 ORDER BY salience DESC, access_count DESC LIMIT ?"
      )
      .all(limit) as MemoryItem[];
  } catch (err) {
    logger.error({ err }, "Failed to get top salient items");
    return [];
  }
}
