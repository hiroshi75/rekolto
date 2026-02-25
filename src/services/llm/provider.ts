export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface LLMProvider {
  chat(messages: Message[], options?: ChatOptions): Promise<string>;
}
