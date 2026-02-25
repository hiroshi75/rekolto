import { getRecentItems, getTagsForItem } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { getDict } from "@/lib/i18n";
import { SearchForm } from "@/components/search-form";

export default async function SearchPage() {
  const locale = await getLocale();
  const t = getDict(locale);
  const items = getRecentItems(20);

  const tags: Record<string, string[]> = {};
  for (const item of items) {
    tags[item.id] = getTagsForItem(item.id);
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-100 mb-6">{t.search_heading}</h1>
      <SearchForm initialItems={items} initialTags={tags} dict={t} />
    </div>
  );
}
