import { getItemsByTag, getTagsForItem } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { getDict, fmt } from "@/lib/i18n";
import { ItemCard } from "@/components/item-card";
import type { Metadata } from "next";

type Props = { params: Promise<{ name: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const tagName = decodeURIComponent(name);
  return { title: `#${tagName} - Rekolto` };
}

export default async function TagItemsPage({ params }: Props) {
  const { name } = await params;
  const locale = await getLocale();
  const t = getDict(locale);
  const tagName = decodeURIComponent(name);
  const items = getItemsByTag(tagName);

  const itemTags = new Map<string, string[]>();
  for (const item of items) {
    itemTags.set(item.id, getTagsForItem(item.id));
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          <span className="text-faint">#</span>
          {tagName}
        </h1>
        <p className="text-sm text-muted mt-1">{fmt(t.n_items, items.length)}</p>
      </div>

      {items.length === 0 ? (
        <p className="text-faint">{t.no_items_with_tag}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} tags={itemTags.get(item.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
