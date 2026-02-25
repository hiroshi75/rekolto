import Link from "next/link";
import type { Item } from "@/lib/types";
import { TagChip } from "./tag-chip";

export function ItemCard({ item, tags }: { item: Item; tags?: string[] }) {
  const displayTitle = item.title || item.type;
  const snippet = item.summary || item.content.slice(0, 200);

  return (
    <Link
      href={`/items/${item.id}`}
      className="block p-4 bg-surface rounded-lg border border-surface-border hover:border-accent/30 transition-colors duration-150 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-white truncate">{displayTitle}</h3>
          <p className="text-sm text-muted mt-1 line-clamp-2">{snippet}</p>
        </div>
        <span className="text-xs text-faint shrink-0 font-medium uppercase tracking-wide">
          {item.type}
        </span>
      </div>
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {tags.map((t) => (
            <TagChip key={t} name={t} />
          ))}
        </div>
      )}
      <time className="block text-xs text-faint mt-2">
        {new Date(item.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </time>
    </Link>
  );
}
