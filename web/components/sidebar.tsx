"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Dict, Locale } from "@/lib/i18n";

export function Sidebar({ dict: t }: { dict: Dict; locale: Locale }) {
  const pathname = usePathname();

  const NAV = [
    { href: "/", label: t.nav_search },
    { href: "/tags", label: t.nav_tags },
    { href: "/insight", label: t.nav_insight },
    { href: "/stats", label: t.nav_stats },
    { href: "/settings", label: t.nav_settings },
  ];

  return (
    <aside className="fixed top-0 left-0 w-56 h-screen bg-surface border-r border-surface-border flex flex-col z-40">
      <div className="p-5 border-b border-surface-border">
        <Link href="/" className="text-xl font-bold tracking-tight text-white">
          Rekolto
        </Link>
        <p className="text-xs text-faint mt-1">{t.subtitle}</p>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {NAV.map(({ href, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`block px-3 py-2 rounded-lg text-sm transition-colors duration-150 cursor-pointer ${
                active
                  ? "bg-surface-hover text-white font-medium"
                  : "text-muted hover:text-white hover:bg-surface-hover/60"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
