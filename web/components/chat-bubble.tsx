"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createSessionAction, chatSearchAction } from "@/lib/actions";
import type { Item } from "@/lib/types";
import type { Dict } from "@/lib/i18n";

// --- Chat Bubble ---

export function ChatBubble({
  type,
  content,
}: {
  type: "user" | "system";
  content: string;
}) {
  if (type === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-2.5 bg-accent/20 text-white rounded-2xl rounded-br-sm">
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mt-2">
      <div className="max-w-[80%] px-4 py-2.5 bg-surface border border-surface-border text-muted rounded-2xl rounded-bl-sm">
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}

// --- Result Cards ---

export function ResultCards({
  items,
  tags,
}: {
  items: Item[];
  tags: Record<string, string[]>;
}) {
  return (
    <div className="space-y-2 ml-2">
      {items.map((item) => (
        <Link
          key={item.id}
          href={`/items/${item.id}`}
          className="block p-3 bg-surface rounded-lg border border-surface-border hover:border-accent/30 transition-colors duration-150"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-medium text-white truncate">
                {item.title || item.type}
              </h4>
              <p className="text-xs text-muted mt-1 line-clamp-2">
                {item.summary || item.content.slice(0, 150)}
              </p>
            </div>
            <span className="text-[10px] text-faint shrink-0 font-medium uppercase tracking-wide">
              {item.type}
            </span>
          </div>
          {tags[item.id] && tags[item.id].length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags[item.id].map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 bg-surface-hover text-faint rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}

// --- New Chat Input (Landing Page) ---

export function NewChatInput({ dict: t }: { dict: Dict }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = input.trim();
    if (!query || isPending) return;

    startTransition(async () => {
      // Create session, then search, then redirect
      const session = await createSessionAction();
      await chatSearchAction(session.id, query);
      router.push(`/chat/${session.id}`);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex gap-3 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.chat_placeholder}
          rows={1}
          disabled={isPending}
          className="flex-1 px-4 py-3 bg-surface border border-surface-border rounded-xl text-white placeholder-faint focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-colors duration-150 resize-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isPending || !input.trim()}
          className="px-5 py-3 bg-accent text-white rounded-xl hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 font-medium cursor-pointer shrink-0"
        >
          {isPending ? t.chat_searching : t.chat_send}
        </button>
      </div>
    </form>
  );
}
