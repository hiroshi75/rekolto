"use client";

import { useState, useTransition } from "react";
import { saveXCrawlerSettingsAction } from "@/lib/actions";
import type { Dict } from "@/lib/i18n";

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export interface XCrawlerSettingsData {
  enabled: boolean;
  timezone: string;
  scheduled_times: string[];
  max_items_per_crawl: number;
}

export function XCrawlerSettings({
  initial,
  t,
}: {
  initial: XCrawlerSettingsData;
  t: Dict;
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [times, setTimes] = useState<string[]>(initial.scheduled_times);
  const [maxItems, setMaxItems] = useState(initial.max_items_per_crawl);
  const [newTime, setNewTime] = useState("09:00");
  const [isPending, startTransition] = useTransition();
  const [showSaved, setShowSaved] = useState(false);

  function addTime() {
    if (newTime && !times.includes(newTime)) {
      setTimes([...times, newTime].sort());
    }
  }

  function removeTime(t: string) {
    setTimes(times.filter((x) => x !== t));
  }

  function handleSave() {
    setShowSaved(false);
    startTransition(async () => {
      await saveXCrawlerSettingsAction({
        enabled,
        timezone,
        scheduled_times: times,
        max_items_per_crawl: maxItems,
      });
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    });
  }

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{t.x_crawler_enabled}</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
            enabled ? "bg-accent" : "bg-surface-border"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Timezone */}
      <div className="space-y-1.5">
        <label className="text-sm text-muted">{t.x_crawler_timezone}</label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40"
        >
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      {/* Scheduled Times */}
      <div className="space-y-1.5">
        <label className="text-sm text-muted">{t.x_crawler_scheduled_times}</label>
        {times.length === 0 && (
          <p className="text-xs text-faint">{t.x_crawler_no_times}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {times.map((time) => (
            <span
              key={time}
              className="inline-flex items-center gap-1 bg-surface-hover border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white"
            >
              {time}
              <button
                type="button"
                onClick={() => removeTime(time)}
                className="text-faint hover:text-white ml-1 cursor-pointer"
                aria-label={`Remove ${time}`}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2 mt-1">
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="bg-surface border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent/40"
          />
          <button
            type="button"
            onClick={addTime}
            className="px-3 py-1.5 text-sm rounded-lg border border-surface-border text-muted hover:text-white hover:border-surface-hover transition-colors cursor-pointer"
          >
            {t.x_crawler_add_time}
          </button>
        </div>
      </div>

      {/* Max items */}
      <div className="space-y-1.5">
        <label className="text-sm text-muted">{t.x_crawler_max_items}</label>
        <input
          type="number"
          min={1}
          max={50}
          value={maxItems}
          onChange={(e) => setMaxItems(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
          className="w-24 bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/40"
        />
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className={`px-4 py-2 text-sm rounded-lg bg-accent text-white hover:bg-accent/80 transition-colors cursor-pointer ${
            isPending ? "opacity-50" : ""
          }`}
        >
          {t.x_crawler_save}
        </button>
        {showSaved && (
          <span className="text-sm text-accent">{t.saved}</span>
        )}
      </div>
    </div>
  );
}
