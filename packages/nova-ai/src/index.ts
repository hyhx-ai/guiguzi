// ─── Guiguzi AI: Provider Abstraction Layer ───
// Unified interface for 20+ LLM providers

// ─── Core Types ───

export type Role = "system" | "user" | "assistant" | "tool";

export interface Message {
  role: Role;
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export interface StreamChunk {
  type: "text" | "tool_call" | "done" | "error";
  text?: string;
  toolCall?: Partial<ToolCall>;
  usage?: TokenUsage;
  error?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatOptions {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  tools?: ToolDefinition[];
  stream?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

// ─── Provider Interface ───

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  organization?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly models: ModelInfo[];

  chat(options: ChatOptions): Promise<ChatResponse>;
  chatStream(options: ChatOptions): AsyncIterable<StreamChunk>;

  isAvailable(): Promise<boolean>;
  getHealth(): Promise<ProviderHealth>;
}

export interface ChatResponse {
  id: string;
  provider: string;
  model: string;
  message: Message;
  usage: TokenUsage;
  finishReason: "stop" | "tool_calls" | "length" | "error";
}

export interface ProviderHealth {
  provider: string;
  status: "healthy" | "degraded" | "unavailable";
  latencyMs: number;
  lastChecked: Date;
  errorRate: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  costPerMInput: number;   // USD per million tokens
  costPerMOutput: number;
  capabilities: TaskType[];
  quality: number;          // 0-100
  speed: number;            // 0-100
}

// ─── Task Classification ───

export type TaskType =
  | "complex-code"
  | "code"
  | "debug"
  | "review"
  | "test"
  | "doc"
  | "refactor"
  | "translate"
  | "simple"
  | "autocomplete"
  | "arch";

export interface TaskClassification {
  type: TaskType;
  confidence: number;
  keywords: string[];
}

// ─── Built-in Provider Registry ───

export { OpenAIProvider } from "./providers/openai.js";
export { AnthropicProvider } from "./providers/anthropic.js";
export { OllamaProvider } from "./providers/ollama.js";
export { GenericOpenAIProvider } from "./providers/generic.js";
export { GoogleProvider } from "./providers/google.js";
export { DeepSeekProvider } from "./providers/deepseek.js";
export { QwenProvider } from "./providers/qwen.js";
export { GLMProvider } from "./providers/glm.js";
export { MoonshotProvider } from "./providers/moonshot.js";
export { MiniMaxProvider } from "./providers/minimax.js";
export { GroqProvider } from "./providers/groq.js";
export { TogetherProvider } from "./providers/together.js";
export { XAIProvider } from "./providers/xai.js";
export {
  createProvider,
  getProviderRegistry,
  autoConfigureRegistry,
  resetProviderRegistry,
  PROVIDER_CATALOG,
  type ProviderCatalogEntry,
} from "./registry.js";
export { loadConfig, applyConfigToEnv, type GuiguziConfig } from "./config.js";
export { classifyTask } from "./classifier.js";
