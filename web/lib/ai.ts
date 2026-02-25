import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parse } from "yaml";
import path from "node:path";
import { config as loadEnv } from "dotenv";

// Load .env from parent project
loadEnv({ path: path.resolve(process.cwd(), "../.env") });

interface LLMProfile {
  provider: string;
  model: string;
  api_key: string;
}

interface CachedSummary {
  summary: string;
  generatedAt: string;
}

const CACHE_DIR = path.resolve(process.cwd(), "../data");
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function cachePath(locale: string): string {
  return path.join(CACHE_DIR, `insight-cache-${locale}.json`);
}

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] ?? "");
}

function resolveDeep(obj: unknown): unknown {
  if (typeof obj === "string") return resolveEnvVars(obj);
  if (Array.isArray(obj)) return obj.map(resolveDeep);
  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveDeep(value);
    }
    return result;
  }
  return obj;
}

function getLLMProfile(): LLMProfile {
  const configPath = path.resolve(process.cwd(), "../rekolto.config.yaml");
  const raw = readFileSync(configPath, "utf-8");
  const parsed = resolveDeep(parse(raw)) as { llm: { profiles: Record<string, LLMProfile> } };
  return parsed.llm.profiles.default;
}

function getCachedSummary(locale: string): CachedSummary | null {
  const p = cachePath(locale);
  if (!existsSync(p)) return null;
  try {
    const data = JSON.parse(readFileSync(p, "utf-8")) as CachedSummary;
    const age = Date.now() - new Date(data.generatedAt).getTime();
    if (age < CACHE_TTL_MS) return data;
  } catch { /* cache corrupt, regenerate */ }
  return null;
}

function saveCachedSummary(locale: string, summary: string): void {
  const data: CachedSummary = { summary, generatedAt: new Date().toISOString() };
  try {
    writeFileSync(cachePath(locale), JSON.stringify(data, null, 2));
  } catch { /* non-critical */ }
}

function buildSystemPrompt(lang: string): string {
  return `You are a personal knowledge analyst for "Rekolto".
Your job is to write a short, scannable Weekly Digest from the user's recent activity.

Structure (use these exact section headings as plain text, followed by a line break):

Trending Topics
  One short paragraph (2-3 sentences). Name the dominant themes this week.
  Be specific — mention actual topic names from the data, not vague generalities.

Connections
  One short paragraph (2-3 sentences). Point out a non-obvious link between two or more topics.
  Example: "Your interest in X and Y both relate to Z" or "The search for A complements your saved article about B."
  If no meaningful connection exists, skip this section entirely.

What's Evolving
  One short paragraph (2-3 sentences). Note how the user's interests have shifted,
  deepened, or expanded compared to their overall knowledge base categories.

Style rules:
- Concise: aim for 80-120 words total. Readers should grasp it in 15 seconds.
- Concrete: use specific topic names and item titles from the data. Never say "various topics."
- Conversational but smart. Write like a knowledgeable colleague, not a formal report.
- Do NOT use Markdown, bullet points, bold, or any formatting. Plain text only.
- Section headings should stand alone on their own line, followed by a blank line, then the paragraph.
- Write in ${lang}.`;
}

const LANG_NAMES: Record<string, string> = {
  en: "English",
  ja: "Japanese",
  "zh-CN": "Simplified Chinese",
  "zh-TW": "Traditional Chinese",
  es: "Spanish",
  "pt-BR": "Brazilian Portuguese",
  ko: "Korean",
};

export async function generateInsightSummary(context: {
  recentItems: { title: string | null; type: string; summary: string | null }[];
  categories: { name: string; item_count: number; summary: string | null }[];
  topMemory: { content: string; type: string; salience: number }[];
  recentSearches: { query: string }[];
  locale?: string;
}): Promise<{ summary: string; fromCache: boolean }> {
  const locale = context.locale ?? "en";

  // Check cache first
  const cached = getCachedSummary(locale);
  if (cached) return { summary: cached.summary, fromCache: true };

  const profile = getLLMProfile();
  if (!profile.api_key) {
    return { summary: "LLM APIキーが設定されていないため、サマリーを生成できません。", fromCache: false };
  }

  const client = new GoogleGenerativeAI(profile.api_key);
  const model = client.getGenerativeModel({
    model: profile.model,
    generationConfig: { temperature: 0.7 },
  });

  const userMessage = `Here is the user's recent activity. Write the Weekly Digest.

RECENT SAVES (${context.recentItems.length}):
${context.recentItems.map((i) => `- ${i.title || "(untitled)"} [${i.type}]${i.summary ? " — " + i.summary : ""}`).join("\n") || "(none)"}

KNOWLEDGE CATEGORIES (${context.categories.length}):
${context.categories.map((c) => `- ${c.name}: ${c.item_count} items`).join("\n") || "(none)"}

TOP MEMORY (${context.topMemory.length}):
${context.topMemory.map((m) => `- ${m.content}`).join("\n") || "(none)"}

RECENT SEARCHES (${context.recentSearches.length}):
${context.recentSearches.map((s) => `- ${s.query}`).join("\n") || "(none)"}`;

  const langName = LANG_NAMES[locale] ?? "English";
  const chat = model.startChat({
    systemInstruction: { role: "user", parts: [{ text: buildSystemPrompt(langName) }] },
  });

  const result = await chat.sendMessage(userMessage);
  const summary = result.response.text();

  saveCachedSummary(locale, summary);

  return { summary, fromCache: false };
}
