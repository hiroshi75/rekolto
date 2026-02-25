"use client";

import { useState } from "react";
import type { MemoryCategory, MemoryItem } from "@/lib/types";

interface CategoryWithItems extends MemoryCategory {
  items: MemoryItem[];
}

export function CategoryAccordion({ categories }: { categories: CategoryWithItems[] }) {
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {categories.map((cat) => {
        const isOpen = openIds.has(cat.id);
        return (
          <div key={cat.id} className="bg-surface rounded-lg border border-surface-border overflow-hidden">
            <button
              onClick={() => toggle(cat.id)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface-hover/40 transition-colors duration-150 cursor-pointer"
              aria-expanded={isOpen}
            >
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-white">{cat.name}</h3>
                {cat.summary && (
                  <p className="text-xs text-faint mt-0.5 truncate">{cat.summary}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="text-xs text-faint tabular-nums">
                  {cat.item_count}
                </span>
                <svg
                  className={`w-4 h-4 text-faint transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            {isOpen && cat.items.length > 0 && (
              <div className="border-t border-surface-border divide-y divide-surface-border/60">
                {cat.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 py-2.5 px-4">
                    <p className="flex-1 text-sm text-muted leading-relaxed break-words min-w-0">
                      {item.content}
                    </p>
                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      <span className="inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded-md bg-surface-hover text-muted border border-surface-border">
                        {item.type}
                      </span>
                      <span className="text-[10px] text-faint tabular-nums">
                        {item.salience.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
