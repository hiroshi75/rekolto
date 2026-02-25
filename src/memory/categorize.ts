import { getDb } from "../db/database.js";
import { getMemoryItemsByCategory } from "../db/memory-store.js";
import type { MemoryCategory } from "../db/memory-store.js";
import { getLLM } from "../services/llm/index.js";
import type { Message } from "../services/llm/provider.js";
import { logger } from "../utils/logger.js";

/**
 * Parse a JSON response from the LLM, handling markdown code blocks.
 */
function parseJsonResponse<T>(raw: string): T {
  let cleaned = raw.trim();
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }
  return JSON.parse(cleaned) as T;
}

const SUGGEST_CATEGORY_SYSTEM_PROMPT = `あなたはナレッジ管理アシスタントです。与えられたコンテンツに最も適切なカテゴリ名を1つ提案してください。

ルール:
- 既存のカテゴリ一覧が提供されます。内容が既存カテゴリに合う場合はそのカテゴリ名を返してください。
- 類似の名前（例: "Rust" と "Rust言語"、"TypeScript" と "TS"）がある場合は既存のカテゴリ名にマージしてください。
- どの既存カテゴリにも合わない場合は、新しい適切なカテゴリ名を提案してください。
- カテゴリ名は短く簡潔に（例: "Rust", "AI/ML", "Web開発", "データベース"）。
- 以下のJSON形式で返してください:

{"category": "カテゴリ名"}

JSON以外のテキストは含めないでください。`;

/**
 * Use LLM to suggest the best category name for the given content,
 * considering existing categories to avoid duplicates.
 */
export async function suggestCategory(
  content: string,
  existingCategories: string[]
): Promise<string> {
  try {
    const llm = getLLM("default");

    const userContent = [
      "既存カテゴリ一覧:",
      existingCategories.length > 0
        ? existingCategories.map((c) => `  - ${c}`).join("\n")
        : "  （なし）",
      "",
      "コンテンツ:",
      content.slice(0, 2000),
    ].join("\n");

    const messages: Message[] = [
      { role: "system", content: SUGGEST_CATEGORY_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ];

    const response = await llm.chat(messages, {
      temperature: 0.2,
    });

    const result = parseJsonResponse<{ category: string }>(response);

    if (!result.category || typeof result.category !== "string") {
      throw new Error("LLM response missing 'category' field");
    }

    logger.info(
      { suggestedCategory: result.category, existingCount: existingCategories.length },
      "Category suggestion complete"
    );

    return result.category;
  } catch (err) {
    logger.error({ err }, "Failed to suggest category, falling back to 'General'");
    return "General";
  }
}

const SUMMARIZE_CATEGORY_SYSTEM_PROMPT = `あなたはナレッジ管理アシスタントです。あるカテゴリに属するメモリアイテム一覧が与えられます。このカテゴリ全体の要約を2〜3文で作成してください。

ルール:
- 日本語で簡潔に要約してください。
- カテゴリ内の知識の主なテーマや傾向をまとめてください。
- 以下のJSON形式で返してください:

{"summary": "カテゴリの要約文"}

JSON以外のテキストは含めないでください。`;

/**
 * Generate a summary for a category based on its memory items using LLM,
 * and update the memory_categories.summary column.
 */
export async function summarizeCategory(categoryId: number): Promise<void> {
  try {
    const db = getDb();

    const category = db
      .prepare("SELECT * FROM memory_categories WHERE id = ?")
      .get(categoryId) as MemoryCategory | undefined;

    if (!category) {
      logger.warn({ categoryId }, "Category not found for summarization");
      return;
    }

    const items = getMemoryItemsByCategory(categoryId);

    if (items.length === 0) {
      logger.info({ categoryId, categoryName: category.name }, "No items in category to summarize");
      return;
    }

    const llm = getLLM("default");

    const itemsList = items
      .slice(0, 30) // Limit to avoid exceeding token limits
      .map((item, i) => `${i + 1}. [${item.type}] ${item.content}`)
      .join("\n");

    const userContent = [
      `カテゴリ名: ${category.name}`,
      `アイテム数: ${items.length}`,
      "",
      "アイテム一覧:",
      itemsList,
    ].join("\n");

    const messages: Message[] = [
      { role: "system", content: SUMMARIZE_CATEGORY_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ];

    const response = await llm.chat(messages, {
      temperature: 0.3,
    });

    const result = parseJsonResponse<{ summary: string }>(response);

    if (!result.summary || typeof result.summary !== "string") {
      throw new Error("LLM response missing 'summary' field");
    }

    db.prepare(
      "UPDATE memory_categories SET summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(result.summary, categoryId);

    logger.info(
      { categoryId, categoryName: category.name, summary: result.summary.slice(0, 80) },
      "Category summary updated"
    );
  } catch (err) {
    logger.error({ err, categoryId }, "Failed to summarize category");
  }
}
