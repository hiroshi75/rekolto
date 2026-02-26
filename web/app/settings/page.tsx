import { getLocale } from "@/lib/locale";
import { getDict, LOCALES, LOCALE_LABELS } from "@/lib/i18n";
import { getXCrawlerSettings } from "@/lib/db";
import { LanguageSelector } from "./language-selector";
import { XCrawlerSettings } from "./x-crawler-settings";

export default async function SettingsPage() {
  const locale = await getLocale();
  const t = getDict(locale);
  const crawlerSettings = getXCrawlerSettings();

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-white">{t.settings_heading}</h1>

      <section className="bg-surface rounded-lg border border-surface-border p-5 space-y-4">
        <h2 className="text-xs font-semibold text-faint uppercase tracking-wide">
          {t.language}
        </h2>
        <LanguageSelector
          currentLocale={locale}
          locales={[...LOCALES]}
          labels={LOCALE_LABELS}
          savedLabel={t.saved}
        />
      </section>

      <section className="bg-surface rounded-lg border border-surface-border p-5 space-y-4">
        <h2 className="text-xs font-semibold text-faint uppercase tracking-wide">
          {t.x_crawler}
        </h2>
        <XCrawlerSettings initial={crawlerSettings} t={t} />
      </section>
    </div>
  );
}
