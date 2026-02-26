import { getDb } from "./database.js";

export interface CrawlerSettings {
  enabled: boolean;
  timezone: string;
  scheduled_times: string[]; // ["09:00","15:00"]
  max_items_per_crawl: number;
}

interface CrawlerSettingsRow {
  enabled: number;
  timezone: string;
  scheduled_times: string;
  max_items_per_crawl: number;
}

export function readCrawlerSettings(): CrawlerSettings {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT enabled, timezone, scheduled_times, max_items_per_crawl FROM x_crawler_settings WHERE id = 1"
    )
    .get() as CrawlerSettingsRow | undefined;

  if (!row) {
    return {
      enabled: false,
      timezone: "UTC",
      scheduled_times: [],
      max_items_per_crawl: 10,
    };
  }

  let times: string[];
  try {
    times = JSON.parse(row.scheduled_times);
  } catch {
    times = [];
  }

  return {
    enabled: row.enabled === 1,
    timezone: row.timezone,
    scheduled_times: times,
    max_items_per_crawl: row.max_items_per_crawl,
  };
}
