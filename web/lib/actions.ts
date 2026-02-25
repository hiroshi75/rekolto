"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import * as db from "./db";
import { isLocale } from "./i18n";
import type { Item } from "./types";

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
