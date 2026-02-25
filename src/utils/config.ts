import { readFileSync } from "node:fs";
import { parse } from "yaml";

export interface LLMProfile {
  provider: string;
  model: string;
  api_key: string;
  base_url?: string;
}

export interface Config {
  telegram: {
    bot_token: string;
    allowed_users: number[];
  };
  llm: {
    profiles: Record<string, LLMProfile>;
  };
  pageindex: {
    llm_profile: string;
    max_pages_per_node: number;
    min_content_length_for_tree: number;
  };
  memory: {
    salience: { decay_rate: number; access_boost: number };
    proactive: { enabled: boolean; max_suggestions: number };
  };
  browser_relay: {
    enabled: boolean;
    ws_port: number;
  };
  scraper: {
    timeout_ms: number;
    max_content_length: number;
  };
  database: {
    path: string;
    backup_dir: string;
  };
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

let _config: Config | null = null;

export function loadConfig(path = "rekolto.config.yaml"): Config {
  if (_config) return _config;
  const raw = readFileSync(path, "utf-8");
  const parsed = parse(raw);
  _config = resolveDeep(parsed) as Config;
  return _config;
}
