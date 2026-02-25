"use client";

import { useTransition, useState } from "react";
import { searchAction } from "@/lib/actions";
import { ItemCard } from "@/components/item-card";
import type { Item } from "@/lib/types";
import { type Dict, fmt } from "@/lib/i18n";

interface SearchFormProps {
  initialItems: Item[];
  initialTags: Record<string, string[]>;
  dict: Dict;
}

export function SearchForm({ initialItems, initialTags, dict: t }: SearchFormProps) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [tags, setTags] = useState<Record<string, string[]>>(initialTags);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [hasSearched, setHasSearched] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setItems(initialItems);
      setTags(initialTags);
      setHasSearched(false);
      return;
    }
    startTransition(async () => {
      const results = await searchAction(trimmed);
      setItems(results);
      setTags({});
      setHasSearched(true);
    });
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="mb-6" role="search">
        <div className="flex gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search_placeholder}
            aria-label={t.search_button}
            className="flex-1 px-4 py-2.5 bg-surface border border-surface-border rounded-lg text-white placeholder-faint focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-colors duration-150"
          />
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2.5 bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 font-medium cursor-pointer"
          >
            {isPending ? t.searching : t.search_button}
          </button>
        </div>
      </form>

      {isPending && (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 border-2 border-surface-border border-t-accent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-muted">{t.searching}</span>
        </div>
      )}

      {!isPending && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-muted">
              {hasSearched ? fmt(t.n_results, items.length) : t.recent_items}
            </h2>
          </div>

          {items.length === 0 ? (
            <p className="text-center text-faint py-12">{t.no_items_found}</p>
          ) : (
            <div className="grid gap-3">
              {items.map((item) => (
                <ItemCard key={item.id} item={item} tags={tags[item.id]} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
