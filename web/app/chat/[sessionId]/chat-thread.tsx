"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { chatSearchAction } from "@/lib/actions";
import { ChatBubble, ResultCards } from "@/components/chat-bubble";
import type { Item, ChatMessage } from "@/lib/types";
import type { Dict } from "@/lib/i18n";
import { fmt } from "@/lib/i18n";

interface MessageData {
  message: ChatMessage;
  items: Item[];
  tags: Record<string, string[]>;
}

interface ChatThreadProps {
  sessionId: string;
  initialMessages: MessageData[];
  dict: Dict;
}

export function ChatThread({ sessionId, initialMessages, dict: t }: ChatThreadProps) {
  const [messages, setMessages] = useState<MessageData[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPending]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = input.trim();
    if (!query || isPending) return;

    setInput("");

    // Optimistic: add user message immediately
    const optimisticMsg: MessageData = {
      message: {
        id: Date.now(),
        session_id: sessionId,
        query,
        results: null,
        created_at: new Date().toISOString(),
      },
      items: [],
      tags: {},
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    startTransition(async () => {
      const { items, messageId } = await chatSearchAction(sessionId, query);
      // Replace optimistic message with real data
      setMessages((prev) =>
        prev.map((m) =>
          m.message.id === optimisticMsg.message.id
            ? {
                message: { ...m.message, id: messageId, results: JSON.stringify(items.map(i => i.id)) },
                items,
                tags: {},
              }
            : m
        )
      );
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] max-w-3xl mx-auto">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted">{t.chat_empty}</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={m.message.id}>
            {/* User query bubble */}
            <ChatBubble type="user" content={m.message.query} />

            {/* Results */}
            {isPending && i === messages.length - 1 && m.items.length === 0 ? (
              <div className="flex items-center gap-2 mt-3 ml-2">
                <div className="h-4 w-4 border-2 border-surface-border border-t-accent rounded-full animate-spin" />
                <span className="text-sm text-muted">{t.chat_searching}</span>
              </div>
            ) : m.items.length > 0 ? (
              <div className="mt-3">
                <p className="text-xs text-faint mb-2 ml-2">
                  {fmt(t.n_results, m.items.length)}
                </p>
                <ResultCards items={m.items} tags={m.tags} />
              </div>
            ) : m.message.results !== null ? (
              <ChatBubble type="system" content={t.chat_no_results} />
            ) : null}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="border-t border-surface-border pt-4 pb-2">
        <div className="flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.chat_placeholder}
            rows={1}
            className="flex-1 px-4 py-3 bg-surface border border-surface-border rounded-xl text-white placeholder-faint focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-colors duration-150 resize-none"
          />
          <button
            type="submit"
            disabled={isPending || !input.trim()}
            className="px-5 py-3 bg-accent text-white rounded-xl hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 font-medium cursor-pointer shrink-0"
          >
            {t.chat_send}
          </button>
        </div>
      </form>
    </div>
  );
}
