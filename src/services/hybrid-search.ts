import { logger } from "../utils/logger.js";
import { searchItems, searchMemoryItems } from "../db/fts.js";
import { getPageIndex } from "../db/page-indices.js";
import { searchDocument } from "./pageindex-bridge.js";
import { getLLM } from "./llm/index.js";
import type { Message } from "./llm/provider.js";
import type { Item } from "../db/items.js";

export interface HybridSearchResult {
  items: {
    item: Item;
    source: "fts" | "pageindex";
    section?: string;
    rank: number;
  }[];
  memorySuggestions: string[];
}

/**
 * 3-layer hybrid search:
 * Layer 1: FTS5 full-text search
 * Layer 2: PageIndex section search (for items that have a page_index)
 * Layer 3: LLM reranking to merge and order results by salience
 */
export async function hybridSearch(
  query: string
): Promise<HybridSearchResult> {
  // --- Layer 1: FTS5 search ---
  let ftsItems: Item[] = [];
  try {
    ftsItems = searchItems(query, 15);
  } catch (err) {
    logger.error({ err, query }, "FTS search failed");
  }

  // Also search memory items for suggestions
  let memorySuggestions: string[] = [];
  try {
    const memoryResults = searchMemoryItems(query, 5);
    memorySuggestions = memoryResults.map((m) => m.content);
  } catch (err) {
    logger.error({ err, query }, "Memory search failed");
  }

  // Build initial results from FTS
  const resultMap = new Map<
    string,
    { item: Item; source: "fts" | "pageindex"; section?: string; rank: number }
  >();

  for (let i = 0; i < ftsItems.length; i++) {
    const item = ftsItems[i];
    resultMap.set(item.id, {
      item,
      source: "fts",
      rank: i + 1,
    });
  }

  // --- Layer 2: PageIndex search ---
  const pageIndexResults: {
    itemId: string;
    sections: { title: string; content: string; path: string }[];
  }[] = [];

  try {
    // Check which FTS items have page indices
    const pageIndexPromises = ftsItems.map(async (item) => {
      const pi = getPageIndex(item.id);
      if (!pi) return null;

      try {
        const treeJson = JSON.parse(pi.tree_json);
        const searchResult = await searchDocument(treeJson, query);
        if (searchResult.sections.length > 0) {
          return { itemId: item.id, sections: searchResult.sections };
        }
      } catch (err) {
        logger.debug(
          { err, itemId: item.id },
          "PageIndex search failed for item"
        );
      }
      return null;
    });

    const results = await Promise.allSettled(pageIndexPromises);
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        pageIndexResults.push(result.value);
      }
    }

    // Update entries with PageIndex results (higher relevance)
    for (const piResult of pageIndexResults) {
      const existing = resultMap.get(piResult.itemId);
      if (existing && piResult.sections.length > 0) {
        // Upgrade source to pageindex and add section info
        existing.source = "pageindex";
        existing.section = piResult.sections
          .map((s) => `[${s.path}] ${s.content.slice(0, 150)}`)
          .join("\n");
      }
    }
  } catch (err) {
    logger.warn(
      { err },
      "PageIndex search layer failed, falling back to FTS-only"
    );
  }

  // --- Layer 3: LLM reranking ---
  let finalResults = Array.from(resultMap.values());

  if (finalResults.length > 1) {
    try {
      finalResults = await rerankWithLLM(query, finalResults);
    } catch (err) {
      logger.warn({ err }, "LLM reranking failed, using FTS order");
      // Keep original FTS order
    }
  }

  return {
    items: finalResults,
    memorySuggestions,
  };
}

/**
 * Use the LLM to rerank search results for relevance to the query.
 */
async function rerankWithLLM(
  query: string,
  results: {
    item: Item;
    source: "fts" | "pageindex";
    section?: string;
    rank: number;
  }[]
): Promise<
  { item: Item; source: "fts" | "pageindex"; section?: string; rank: number }[]
> {
  const llm = getLLM("default");

  // Build a compact representation for the LLM
  const itemSummaries = results.map((r, i) => ({
    index: i,
    title: r.item.title || "(no title)",
    summary: r.item.summary?.slice(0, 200) || r.item.content.slice(0, 200),
    source: r.source,
    section: r.section?.slice(0, 200),
  }));

  const messages: Message[] = [
    {
      role: "system",
      content: `You are a search result reranker. Given a search query and a list of results, return a JSON array of the result indices sorted by relevance (most relevant first).

Return ONLY a JSON array of integers, e.g.: [2, 0, 4, 1, 3]

Rules:
- Include ALL indices from the input.
- Sort by relevance to the query.
- Prefer results with PageIndex section matches.
- Return ONLY the JSON array, no other text.`,
    },
    {
      role: "user",
      content: `Query: ${query}\n\nResults:\n${JSON.stringify(itemSummaries, null, 2)}`,
    },
  ];

  const response = await llm.chat(messages, {
    temperature: 0.1,
  });

  // Parse the response
  let cleaned = response.trim();
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  const ranking = JSON.parse(cleaned) as number[];

  // Validate and apply ranking
  if (!Array.isArray(ranking)) {
    throw new Error("LLM reranking did not return an array");
  }

  const reranked: typeof results = [];
  const seen = new Set<number>();

  for (const idx of ranking) {
    if (typeof idx === "number" && idx >= 0 && idx < results.length && !seen.has(idx)) {
      seen.add(idx);
      reranked.push({ ...results[idx], rank: reranked.length + 1 });
    }
  }

  // Add any results that were missing from the LLM's ranking
  for (let i = 0; i < results.length; i++) {
    if (!seen.has(i)) {
      reranked.push({ ...results[i], rank: reranked.length + 1 });
    }
  }

  return reranked;
}
