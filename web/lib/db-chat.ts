import { getWriteDb } from "./db";
import type { ChatSession, ChatMessage } from "./types";

// --- Chat Sessions ---

export function createChatSession(title?: string): ChatSession {
  const db = getWriteDb();
  try {
    const id = crypto.randomUUID();
    db.prepare(
      "INSERT INTO chat_sessions (id, title) VALUES (?, ?)"
    ).run(id, title ?? null);
    return db.prepare("SELECT * FROM chat_sessions WHERE id = ?").get(id) as ChatSession;
  } finally {
    db.close();
  }
}

export function getChatSessions(): ChatSession[] {
  const db = getWriteDb();
  try {
    return db.prepare(
      "SELECT * FROM chat_sessions ORDER BY updated_at DESC"
    ).all() as ChatSession[];
  } finally {
    db.close();
  }
}

export function getChatSession(id: string): ChatSession | null {
  const db = getWriteDb();
  try {
    const row = db.prepare("SELECT * FROM chat_sessions WHERE id = ?").get(id) as ChatSession | undefined;
    return row ?? null;
  } finally {
    db.close();
  }
}

export function deleteChatSession(id: string): void {
  const db = getWriteDb();
  try {
    db.prepare("DELETE FROM search_history WHERE session_id = ?").run(id);
    db.prepare("DELETE FROM chat_sessions WHERE id = ?").run(id);
  } finally {
    db.close();
  }
}

export function updateSessionTitle(id: string, title: string): void {
  const db = getWriteDb();
  try {
    db.prepare(
      "UPDATE chat_sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(title, id);
  } finally {
    db.close();
  }
}

export function addChatMessage(
  sessionId: string,
  query: string,
  resultIds: string[]
): ChatMessage {
  const db = getWriteDb();
  try {
    const result = db.prepare(
      "INSERT INTO search_history (query, results, session_id) VALUES (?, ?, ?)"
    ).run(query, JSON.stringify(resultIds), sessionId);

    // Update session's updated_at
    db.prepare(
      "UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(sessionId);

    return db.prepare("SELECT * FROM search_history WHERE id = ?").get(
      result.lastInsertRowid
    ) as ChatMessage;
  } finally {
    db.close();
  }
}

export function getChatMessages(sessionId: string): ChatMessage[] {
  const db = getWriteDb();
  try {
    return db.prepare(
      "SELECT * FROM search_history WHERE session_id = ? ORDER BY created_at ASC"
    ).all(sessionId) as ChatMessage[];
  } finally {
    db.close();
  }
}
