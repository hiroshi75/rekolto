import { notFound } from "next/navigation";
import { getChatSession, getChatMessages } from "@/lib/db-chat";
import { getItem, getTagsForItem } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { getDict } from "@/lib/i18n";
import { ChatThread } from "./chat-thread";
import type { Item } from "@/lib/types";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function ChatSessionPage({ params }: PageProps) {
  const { sessionId } = await params;
  const session = getChatSession(sessionId);
  if (!session) notFound();

  const locale = await getLocale();
  const t = getDict(locale);
  const messages = getChatMessages(sessionId);

  // Load items for each message's results
  const messageData = messages.map((msg) => {
    const resultIds: string[] = msg.results ? JSON.parse(msg.results) : [];
    const items: Item[] = resultIds
      .map((id) => getItem(id))
      .filter((item): item is Item => item !== null);
    const tags: Record<string, string[]> = {};
    for (const item of items) {
      tags[item.id] = getTagsForItem(item.id);
    }
    return { message: msg, items, tags };
  });

  return (
    <ChatThread
      sessionId={sessionId}
      initialMessages={messageData}
      dict={t}
    />
  );
}
