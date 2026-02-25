"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { createSessionAction, deleteSessionAction } from "@/lib/actions";
import type { ChatSession } from "@/lib/types";
import type { Dict } from "@/lib/i18n";

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d`;
  return new Date(dateStr).toLocaleDateString();
}

export function ChatSidebar({
  dict: t,
  sessions,
}: {
  dict: Dict;
  sessions: ChatSession[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleNewChat() {
    startTransition(async () => {
      const session = await createSessionAction();
      router.push(`/chat/${session.id}`);
    });
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(t.chat_delete_confirm)) return;
    startTransition(async () => {
      await deleteSessionAction(id);
      if (pathname === `/chat/${id}`) {
        router.push("/");
      } else {
        router.refresh();
      }
    });
  }

  const NAV = [
    { href: "/tags", label: t.nav_tags },
    { href: "/insight", label: t.nav_insight },
    { href: "/stats", label: t.nav_stats },
    { href: "/settings", label: t.nav_settings },
  ];

  return (
    <aside className="fixed top-0 left-0 w-64 h-screen bg-surface border-r border-surface-border flex flex-col z-40">
      {/* Top: Brand + New Chat */}
      <div className="p-4 border-b border-surface-border">
        <Link href="/" className="text-xl font-bold tracking-tight text-white">
          Rekolto
        </Link>
        <p className="text-xs text-faint mt-0.5">{t.subtitle}</p>
        <button
          onClick={handleNewChat}
          disabled={isPending}
          className="mt-3 w-full px-3 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors duration-150 cursor-pointer"
        >
          + {t.new_chat}
        </button>
      </div>

      {/* Middle: Session list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {sessions.map((session) => {
          const isActive = pathname === `/chat/${session.id}`;
          return (
            <Link
              key={session.id}
              href={`/chat/${session.id}`}
              className={`group flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${
                isActive
                  ? "bg-surface-hover text-white"
                  : "text-muted hover:text-white hover:bg-surface-hover/60"
              }`}
            >
              <span className="truncate flex-1 min-w-0">
                {session.title || "Untitled"}
              </span>
              <span className="flex items-center gap-1 shrink-0 ml-2">
                <span className="text-xs text-faint">
                  {relativeTime(session.updated_at)}
                </span>
                <button
                  onClick={(e) => handleDelete(e, session.id)}
                  className="opacity-0 group-hover:opacity-100 text-faint hover:text-red-400 transition-opacity duration-150 p-0.5 cursor-pointer"
                  title={t.chat_delete_session}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5A.75.75 0 0 1 9.95 6Z" clipRule="evenodd" />
                  </svg>
                </button>
              </span>
            </Link>
          );
        })}
      </div>

      {/* Bottom: Nav links */}
      <nav className="p-2 border-t border-surface-border space-y-0.5">
        {NAV.map(({ href, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`block px-3 py-1.5 rounded-lg text-sm transition-colors duration-150 ${
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
