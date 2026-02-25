"use client";

import { useState, useTransition } from "react";
import { setLocaleAction } from "@/lib/actions";
import type { Locale } from "@/lib/i18n";

export function LanguageSelector({
  currentLocale,
  locales,
  labels,
  savedLabel,
}: {
  currentLocale: Locale;
  locales: Locale[];
  labels: Record<Locale, string>;
  savedLabel: string;
}) {
  const [selected, setSelected] = useState<Locale>(currentLocale);
  const [isPending, startTransition] = useTransition();
  const [showSaved, setShowSaved] = useState(false);

  function handleChange(locale: Locale) {
    setSelected(locale);
    setShowSaved(false);
    startTransition(async () => {
      await setLocaleAction(locale);
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    });
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-2">
        {locales.map((loc) => (
          <button
            key={loc}
            onClick={() => handleChange(loc)}
            disabled={isPending}
            className={`text-left px-4 py-2.5 rounded-lg border text-sm transition-colors duration-150 cursor-pointer ${
              selected === loc
                ? "bg-surface-hover border-accent/40 text-white"
                : "bg-surface border-surface-border text-muted hover:border-surface-hover hover:text-white"
            } ${isPending ? "opacity-50" : ""}`}
          >
            {labels[loc]}
          </button>
        ))}
      </div>
      {showSaved && (
        <p className="text-sm text-accent mt-3">{savedLabel}</p>
      )}
    </div>
  );
}
