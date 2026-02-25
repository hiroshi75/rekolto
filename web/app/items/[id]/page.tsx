import { notFound } from "next/navigation";
import { getItem, getTagsForItem } from "@/lib/db";
import { deleteItemAction } from "@/lib/actions";
import { getLocale } from "@/lib/locale";
import { getDict } from "@/lib/i18n";
import { TagChip } from "@/components/tag-chip";
import type { Metadata } from "next";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const item = getItem(id);
  return { title: item ? `${item.title || item.type} - Rekolto` : "Not Found" };
}

export default async function ItemDetailPage({ params }: Props) {
  const { id } = await params;
  const locale = await getLocale();
  const t = getDict(locale);
  const item = getItem(id);
  if (!item) notFound();

  const tags = getTagsForItem(item.id);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white break-words">
            {item.title || t.untitled}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-surface-hover text-muted uppercase tracking-wide">
              {item.type}
            </span>
            <time className="text-sm text-faint">
              {new Date(item.created_at).toLocaleDateString(locale, {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </div>
        </div>
        <form
          action={async () => {
            "use server";
            await deleteItemAction(id);
          }}
        >
          <button
            type="submit"
            className="shrink-0 px-3 py-1.5 text-sm rounded-lg bg-red-950/60 text-red-400 hover:bg-red-900/50 border border-red-900/40 transition-colors duration-150 cursor-pointer"
          >
            {t.delete_button}
          </button>
        </form>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <TagChip key={tag} name={tag} />
          ))}
        </div>
      )}

      {/* URL */}
      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm text-accent hover:text-accent-hover underline underline-offset-2 break-all transition-colors duration-150"
        >
          {item.url}
        </a>
      )}

      {/* OG Image */}
      {item.og_image && (
        <img
          src={item.og_image}
          alt={item.title || ""}
          loading="lazy"
          className="w-full rounded-lg border border-surface-border"
        />
      )}

      {/* Summary */}
      {item.summary && (
        <section>
          <h2 className="text-xs font-semibold text-faint uppercase tracking-wide mb-2">
            {t.summary}
          </h2>
          <p className="text-muted leading-relaxed">{item.summary}</p>
        </section>
      )}

      {/* Content */}
      <section>
        <h2 className="text-xs font-semibold text-faint uppercase tracking-wide mb-2">
          {t.content}
        </h2>
        <pre className="whitespace-pre-wrap break-words text-sm text-muted bg-surface border border-surface-border rounded-lg p-4 overflow-x-auto leading-relaxed">
          {item.content}
        </pre>
      </section>
    </div>
  );
}
