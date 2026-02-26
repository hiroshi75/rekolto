"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import * as db from "./db";
import * as chatDb from "./db-chat";
import { isLocale } from "./i18n";
import type { Item, ChatSession } from "./types";

export async function searchAction(query: string): Promise<Item[]> {
  if (!query.trim()) return db.getRecentItems(20);
  try {
    return db.searchItems(query);
  } catch {
    // FTS5 syntax error — fall back to recent items
    return db.getRecentItems(20);
  }
}

export async function deleteItemAction(id: string): Promise<void> {
  db.deleteItem(id);
  revalidatePath("/");
  revalidatePath("/tags");
  revalidatePath("/stats");
  redirect("/");
}

export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  const jar = await cookies();
  jar.set("rekolto_locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}

export async function chatSearchAction(
  sessionId: string,
  query: string
): Promise<{ items: Item[]; messageId: number }> {
  const trimmed = query.trim();
  if (!trimmed) return { items: [], messageId: 0 };

  let items: Item[];
  try {
    items = db.searchItems(trimmed);
  } catch {
    items = db.getRecentItems(20);
  }

  const resultIds = items.map((item) => item.id);
  const msg = chatDb.addChatMessage(sessionId, trimmed, resultIds);

  // Auto-set session title from first message
  const session = chatDb.getChatSession(sessionId);
  if (session && !session.title) {
    chatDb.updateSessionTitle(sessionId, trimmed.slice(0, 100));
  }

  revalidatePath("/", "layout");
  return { items, messageId: msg.id };
}

export async function createSessionAction(): Promise<ChatSession> {
  const session = chatDb.createChatSession();
  revalidatePath("/", "layout");
  return session;
}

export async function deleteSessionAction(id: string): Promise<void> {
  chatDb.deleteChatSession(id);
  revalidatePath("/", "layout");
}

export async function saveXCrawlerSettingsAction(settings: {
  enabled: boolean;
  timezone: string;
  scheduled_times: string[];
  max_items_per_crawl: number;
}): Promise<void> {
  db.saveXCrawlerSettings(settings);
  revalidatePath("/settings");
}
