import { getLLM } from "./llm/index.js";
import type { Message } from "./llm/provider.js";
import { logger } from "../utils/logger.js";

/**
 * Parse a JSON response from the LLM, handling markdown code blocks
 * and truncated responses.
 */
function parseJsonResponse<T>(raw: string): T {
  let cleaned = raw.trim();

  // Try to extract from complete code blocks first
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  } else if (cleaned.startsWith("```")) {
    // Handle unclosed code blocks (truncated response)
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").trim();
  }

  // Extract the JSON object from surrounding text
  const jsonStart = cleaned.indexOf("{");
  if (jsonStart >= 0) {
    cleaned = cleaned.slice(jsonStart);
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to repair truncated JSON by closing brackets
    let repaired = cleaned;
    const opens = (repaired.match(/\{/g) || []).length;
    const closes = (repaired.match(/\}/g) || []).length;

    if (opens > closes) {
      // Remove trailing incomplete value (truncated string, etc.)
      repaired = repaired.replace(/,?\s*"[^"]*$/, "");
      // Remove trailing incomplete key-value
      repaired = repaired.replace(/,?\s*"[^"]*":\s*"?[^"{}[\]]*$/, "");
      // Close any open strings/arrays
      const unclosedArray = (repaired.match(/\[/g) || []).length - (repaired.match(/\]/g) || []).length;
      for (let i = 0; i < unclosedArray; i++) repaired += "]";
      for (let i = 0; i < opens - closes; i++) repaired += "}";
    }

    try {
      return JSON.parse(repaired) as T;
    } catch (e2) {
      logger.error({ raw: raw.slice(0, 500), error: e2 }, "Failed to parse LLM JSON response");
      throw new Error(`Failed to parse LLM response as JSON: ${(e2 as Error).message}`);
    }
  }
}

// --- Summarization & Tagging ---

export interface SummarizeResult {
  summary: string;
  tags: string[];
  type: "article" | "memo" | "code" | "idea" | "reference";
}

const SUMMARIZE_SYSTEM_PROMPT = `あなたはナレッジ管理アシスタントです。与えられたコンテンツを分析し、以下のJSON形式で返してください。

{
  "summary": "2〜3行の日本語要約",
  "tags": ["tag-one", "tag-two"],
  "type": "article"
}

ルール:
- summary: 2〜3行の簡潔な日本語要約を生成してください。
- tags: 最大5つまで。小文字のkebab-case（例: "machine-learning", "web-dev", "rust-lang"）。内容の主要トピックを反映してください。
- type: 以下のいずれかを選択:
  - "article": ブログ記事やニュース記事
  - "memo": 個人的なメモや覚書
  - "code": コードスニペットや技術的な実装
  - "idea": アイデアや構想
  - "reference": ドキュメントやリファレンス資料

JSON以外のテキストは含めないでください。`;

/**
 * Summarize content and generate tags using the LLM.
 */
export async function summarizeContent(
  content: string,
  title?: string
): Promise<SummarizeResult> {
  const llm = getLLM("default");

  const userContent = title
    ? `タイトル: ${title}\n\n${content}`
    : content;

  const messages: Message[] = [
    { role: "system", content: SUMMARIZE_SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];

  logger.info("Requesting LLM summarization");
  const response = await llm.chat(messages, {
    temperature: 0.3,
  });

  const result = parseJsonResponse<SummarizeResult>(response);

  // Validate and sanitize the result
  if (!result.summary || typeof result.summary !== "string") {
    throw new Error("LLM response missing 'summary' field");
  }

  // Ensure tags is an array of strings, max 5
  if (!Array.isArray(result.tags)) {
    result.tags = [];
  }
  result.tags = result.tags
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.toLowerCase().replace(/\s+/g, "-"))
    .slice(0, 5);

  // Validate type
  const validTypes = ["article", "memo", "code", "idea", "reference"] as const;
  if (!validTypes.includes(result.type)) {
    result.type = "article";
  }

  logger.info(
    { summary: result.summary.slice(0, 80), tags: result.tags, type: result.type },
    "Summarization complete"
  );

  return result;
}

// --- Tweet Filtering ---

export interface TweetData {
  text: string;
  author?: string;
  url?: string;
}

export interface FilteredTweet {
  index: number;
  reason: string;
}

const FILTER_TWEETS_SYSTEM_PROMPT = `あなたはナレッジキュレーターです。ユーザーの興味・関心に基づいて、ツイート/ポストのリストからユーザーにとって価値のあるものをフィルタリングしてください。

以下のJSON形式で返してください:
{
  "selected": [
    { "index": 0, "reason": "選択理由" }
  ]
}

ルール:
- ユーザーの興味カテゴリやタグに関連するツイートのみ選択
- 一般的な雑談、挨拶、個人的なツイートは除外
- 技術的な知見、ニュース、学びのあるツイートを優先
- 各ツイートのindexは入力リストの0-based index
- reasonは簡潔に日本語で

JSON以外のテキストは含めないでください。`;

/**
 * Filter tweets by relevance to user's interests using the LLM.
 */
export async function filterRelevantTweets(
  tweets: TweetData[],
  interests: { categories: string[]; tags: string[] }
): Promise<FilteredTweet[]> {
  if (tweets.length === 0) return [];

  const llm = getLLM("default");

  const tweetList = tweets
    .map((t, i) => `[${i}] ${t.author ? `@${t.author}: ` : ""}${t.text}`)
    .join("\n\n");

  const userContent = `## ユーザーの興味・関心
カテゴリ: ${interests.categories.join(", ") || "なし"}
タグ: ${interests.tags.join(", ") || "なし"}

## ツイート一覧
${tweetList}`;

  const messages: Message[] = [
    { role: "system", content: FILTER_TWEETS_SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];

  logger.info({ tweetCount: tweets.length }, "Filtering tweets by relevance");
  const response = await llm.chat(messages, { temperature: 0.2 });

  const result = parseJsonResponse<{ selected: FilteredTweet[] }>(response);

  if (!Array.isArray(result.selected)) return [];

  return result.selected.filter(
    (s) => typeof s.index === "number" && s.index >= 0 && s.index < tweets.length
  );
}

// --- Memory Fact Extraction ---

export interface MemoryFact {
  content: string;
  type: "knowledge" | "profile" | "skill";
}

export interface ExtractMemoryResult {
  facts: MemoryFact[];
  category: string;
}

const EXTRACT_MEMORY_SYSTEM_PROMPT = `あなたはナレッジ管理アシスタントです。与えられたコンテンツから重要な知識・事実を抽出し、以下のJSON形式で返してください。

{
  "facts": [
    { "content": "事実の内容", "type": "knowledge" }
  ],
  "category": "カテゴリ名"
}

ルール:
- facts: コンテンツから重要な知識・事実を抽出してください。各事実は簡潔な1文にまとめてください。
  - type は以下のいずれか:
    - "knowledge": 一般的な知識や技術的事実
    - "profile": ユーザーの好みや属性に関する情報
    - "skill": 技術やスキルに関する情報
  - 最大10個まで抽出してください。
- category: コンテンツの分野を表す短いカテゴリ名（日本語可、例: "Rust", "AI/ML", "Web開発", "データベース"）

JSON以外のテキストは含めないでください。`;

/**
 * Extract key facts and knowledge from content using the LLM.
 */
export async function extractMemoryFacts(
  content: string,
  title?: string
): Promise<ExtractMemoryResult> {
  const llm = getLLM("default");

  const userContent = title
    ? `タイトル: ${title}\n\n${content}`
    : content;

  const messages: Message[] = [
    { role: "system", content: EXTRACT_MEMORY_SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];

  logger.info("Requesting LLM memory fact extraction");
  const response = await llm.chat(messages, {
    temperature: 0.2,
  });

  const result = parseJsonResponse<ExtractMemoryResult>(response);

  // Validate and sanitize the result
  if (!Array.isArray(result.facts)) {
    result.facts = [];
  }

  const validFactTypes = ["knowledge", "profile", "skill"] as const;
  result.facts = result.facts
    .filter(
      (f): f is MemoryFact =>
        f != null &&
        typeof f.content === "string" &&
        f.content.length > 0 &&
        validFactTypes.includes(f.type as (typeof validFactTypes)[number])
    )
    .slice(0, 10);

  if (!result.category || typeof result.category !== "string") {
    result.category = "General";
  }

  logger.info(
    { factCount: result.facts.length, category: result.category },
    "Memory fact extraction complete"
  );

  return result;
}
