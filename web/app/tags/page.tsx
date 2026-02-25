import { getAllTags } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { getDict } from "@/lib/i18n";
import { TagChip } from "@/components/tag-chip";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tags - Rekolto" };

export default async function TagsPage() {
  const locale = await getLocale();
  const t = getDict(locale);
  const tags = getAllTags();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">{t.tags_heading}</h1>

      {tags.length === 0 ? (
        <p className="text-faint">{t.no_tags}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <TagChip key={tag.name} name={tag.name} count={tag.count} />
          ))}
        </div>
      )}
    </div>
  );
}
