import { getStats } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { getDict } from "@/lib/i18n";
import { StatsCard } from "@/components/stats-card";

export default async function StatsPage() {
  const locale = await getLocale();
  const t = getDict(locale);
  const stats = getStats();

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-white">{t.stats_heading}</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatsCard label={t.total_items} value={stats.totalItems} />
        <StatsCard label={t.total_tags} value={stats.totalTags} />
        <StatsCard label={t.memory_items} value={stats.totalMemoryItems} />
        <StatsCard label={t.categories} value={stats.totalCategories} />
        <StatsCard label={t.items_this_week_stat} value={stats.recentItems} sub={t.last_7_days} />
      </div>

      <section>
        <h2 className="text-lg font-semibold text-white mb-4">{t.items_by_type}</h2>
        {stats.itemsByType.length === 0 ? (
          <p className="text-sm text-faint">{t.no_items}</p>
        ) : (
          <div className="bg-surface rounded-lg border border-surface-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-faint uppercase tracking-wide">
                    {t.type}
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-faint uppercase tracking-wide">
                    {t.count}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/60">
                {stats.itemsByType.map(({ type, count }) => (
                  <tr key={type} className="hover:bg-surface-hover/40 transition-colors duration-150">
                    <td className="px-4 py-2.5 text-muted">{type}</td>
                    <td className="px-4 py-2.5 text-faint text-right tabular-nums">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
