import {
  getAllCategories,
  getMemoryItemsByCategory,
  getTopSalientItems,
  getRecentInterests,
  getRecentItems,
  getRediscoverItems,
  getThisWeekActivity,
} from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { getDict } from "@/lib/i18n";
import { generateInsightSummary } from "@/lib/ai";
import type { MemoryItem } from "@/lib/types";
import { CategoryAccordion } from "./category-accordion";

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded-md bg-surface-hover text-muted border border-surface-border">
      {type}
    </span>
  );
}

function SalienceBar({ value }: { value: number }) {
  const pct = Math.min(Math.max(value, 0), 1) * 100;
  return (
    <div className="w-16 h-1.5 rounded-full bg-surface-hover overflow-hidden" title={`Salience: ${value.toFixed(2)}`}>
      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}

function MemoryItemRow({ item }: { item: MemoryItem }) {
  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-surface-hover/40 transition-colors duration-150">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted leading-relaxed break-words">{item.content}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0 pt-0.5">
        <TypeBadge type={item.type} />
        <SalienceBar value={item.salience} />
        <span className="text-xs text-faint w-8 text-right tabular-nums" title="Access count">
          {item.access_count}x
        </span>
      </div>
    </div>
  );
}

export default async function InsightPage() {
  const locale = await getLocale();
  const t = getDict(locale);

  const topItems = getTopSalientItems(5);
  const categories = getAllCategories();
  const recentSearches = getRecentInterests(10);
  const recentItems = getRecentItems(10);
  const rediscoverItems = getRediscoverItems(3);
  const weekActivity = getThisWeekActivity();

  const categoryData = categories.map((cat) => ({
    ...cat,
    items: getMemoryItemsByCategory(cat.id),
  }));

  let summaryText = "";
  let summaryFromCache = false;
  try {
    const result = await generateInsightSummary({
      recentItems: recentItems.map((i) => ({
        title: i.title, type: i.type, summary: i.summary,
      })),
      categories: categories.map((c) => ({
        name: c.name, item_count: c.item_count, summary: c.summary,
      })),
      topMemory: topItems.map((m) => ({
        content: m.content, type: m.type, salience: m.salience,
      })),
      recentSearches: recentSearches.map((s) => ({ query: s.query })),
      locale,
    });
    summaryText = result.summary;
    summaryFromCache = result.fromCache;
  } catch {
    summaryText = "";
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-white">{t.insight_heading}</h1>

      {/* Executive Summary */}
      {summaryText && (
        <section className="relative bg-surface rounded-xl border border-surface-border p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            <h2 className="text-sm font-semibold text-accent uppercase tracking-wide">
              {t.weekly_digest}
            </h2>
            {summaryFromCache && (
              <span className="text-[10px] text-faint ml-auto">{t.cached}</span>
            )}
          </div>
          <div className="text-sm text-muted leading-relaxed whitespace-pre-line">
            {summaryText}
          </div>
        </section>
      )}

      {/* This Week */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 bg-surface rounded-lg border border-surface-border">
          <p className="text-xs text-faint uppercase tracking-wide font-medium">{t.items_this_week}</p>
          <p className="text-2xl font-bold text-white mt-1 tabular-nums">{weekActivity.itemsAdded}</p>
        </div>
        <div className="p-4 bg-surface rounded-lg border border-surface-border">
          <p className="text-xs text-faint uppercase tracking-wide font-medium">{t.searches_this_week}</p>
          <p className="text-2xl font-bold text-white mt-1 tabular-nums">{weekActivity.searchCount}</p>
        </div>
      </div>

      {/* Rediscover */}
      {rediscoverItems.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">{t.rediscover}</h2>
          <div className="space-y-2">
            {rediscoverItems.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-surface rounded-lg border border-surface-border border-l-2 border-l-amber-500/60"
              >
                <p className="text-sm text-muted leading-relaxed">{item.content}</p>
                <div className="flex items-center gap-2 mt-2">
                  <TypeBadge type={item.type} />
                  <span className="text-xs text-faint">{item.category_name}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Key Knowledge */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">{t.key_knowledge}</h2>
        {topItems.length === 0 ? (
          <p className="text-sm text-faint">{t.no_memory_items}</p>
        ) : (
          <div className="bg-surface rounded-lg border border-surface-border divide-y divide-surface-border">
            {topItems.map((item) => (
              <MemoryItemRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* Categories */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">{t.categories}</h2>
        {categories.length === 0 ? (
          <p className="text-sm text-faint">{t.no_categories}</p>
        ) : (
          <CategoryAccordion categories={categoryData} />
        )}
      </section>

      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">{t.recent_searches}</h2>
          <div className="bg-surface rounded-lg border border-surface-border divide-y divide-surface-border">
            {recentSearches.map((s, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-muted">{s.query}</span>
                <span className="text-xs text-faint shrink-0 ml-4">
                  {new Date(s.created_at).toLocaleDateString(locale, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
