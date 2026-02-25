import { loadConfig } from "../utils/config.js";
import { getLLM } from "../services/llm/index.js";
import type { Message } from "../services/llm/provider.js";
import { getTopSalientItems } from "./salience.js";
import { getAllCategories } from "../db/memory-store.js";
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

const PROACTIVE_SYSTEM_PROMPT = `あなたはナレッジ管理アシスタントです。ユーザーの現在のコンテキスト（検索クエリや新しく保存されたカテゴリ）と、過去に保存された知識を元に、関連する提案を行ってください。

ルール:
- 提案は日本語で、自然な文章で作成してください。
- 「以前保存した○○の記事にも関連情報があります」のような形式で提案してください。
- 各提案は簡潔に1文にまとめてください。
- 以下のJSON形式で返してください:

{"suggestions": ["提案1", "提案2", ...]}

JSON以外のテキストは含めないでください。`;

/**
 * Given a search query or newly saved item's category, suggest related memories
 * the user might find useful. Uses LLM to generate natural language suggestions.
 *
 * @param context.query The current search query (optional).
 * @param context.newItemCategory The category of a newly saved item (optional).
 * @returns Array of suggestion strings. Returns empty array if proactive is disabled.
 */
export async function getProactiveSuggestions(context: {
  query?: string;
  newItemCategory?: string;
}): Promise<string[]> {
  try {
    const config = loadConfig();

    // Check if proactive suggestions are enabled
    if (!config.memory.proactive.enabled) {
      logger.debug("Proactive suggestions disabled in config");
      return [];
    }

    const maxSuggestions = config.memory.proactive.max_suggestions;

    // Gather context: top salient items and categories
    const topItems = getTopSalientItems(10);
    const categories = getAllCategories();

    // If no knowledge base exists yet, skip suggestions
    if (topItems.length === 0 && categories.length === 0) {
      logger.debug("No memory items or categories available for proactive suggestions");
      return [];
    }

    const llm = getLLM("default");

    // Build context for the LLM
    const contextParts: string[] = [];

    if (context.query) {
      contextParts.push(`ユーザーの検索クエリ: "${context.query}"`);
    }
    if (context.newItemCategory) {
      contextParts.push(`新しく保存されたアイテムのカテゴリ: "${context.newItemCategory}"`);
    }

    contextParts.push("");
    contextParts.push("保存済みのカテゴリ一覧:");
    if (categories.length > 0) {
      for (const cat of categories.slice(0, 20)) {
        const summary = cat.summary ? ` — ${cat.summary}` : "";
        contextParts.push(`  - ${cat.name} (${cat.item_count}件)${summary}`);
      }
    } else {
      contextParts.push("  （なし）");
    }

    contextParts.push("");
    contextParts.push("よくアクセスされる知識:");
    if (topItems.length > 0) {
      for (const item of topItems.slice(0, 10)) {
        contextParts.push(`  - ${item.content} (salience: ${item.salience.toFixed(2)})`);
      }
    } else {
      contextParts.push("  （なし）");
    }

    contextParts.push("");
    contextParts.push(`最大${maxSuggestions}件の提案を生成してください。`);

    const messages: Message[] = [
      { role: "system", content: PROACTIVE_SYSTEM_PROMPT },
      { role: "user", content: contextParts.join("\n") },
    ];

    const response = await llm.chat(messages, {
      temperature: 0.5,
    });

    const result = parseJsonResponse<{ suggestions: string[] }>(response);

    if (!Array.isArray(result.suggestions)) {
      logger.warn("LLM response missing 'suggestions' array");
      return [];
    }

    const suggestions = result.suggestions
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .slice(0, maxSuggestions);

    logger.info(
      { context, suggestionCount: suggestions.length },
      "Proactive suggestions generated"
    );

    return suggestions;
  } catch (err) {
    logger.error({ err, context }, "Failed to generate proactive suggestions");
    return [];
  }
}
