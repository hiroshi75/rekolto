import { loadConfig } from "../../utils/config.js";
import type { LLMProvider } from "./provider.js";
import { GoogleProvider } from "./google.js";

const providers = new Map<string, LLMProvider>();

export function getLLM(profile = "default"): LLMProvider {
  const cached = providers.get(profile);
  if (cached) return cached;

  const config = loadConfig();
  const profileConfig = config.llm.profiles[profile];
  if (!profileConfig) {
    throw new Error(`LLM profile "${profile}" not found in config`);
  }

  let provider: LLMProvider;

  switch (profileConfig.provider) {
    case "google":
      provider = new GoogleProvider(profileConfig.api_key, profileConfig.model);
      break;
    default:
      throw new Error(`Unknown LLM provider: ${profileConfig.provider}`);
  }

  providers.set(profile, provider);
  return provider;
}

export type { LLMProvider, Message, ChatOptions } from "./provider.js";
