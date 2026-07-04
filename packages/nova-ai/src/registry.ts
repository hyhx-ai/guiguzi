// ─── Provider Registry ───
// Central registry for all AI providers

import type { AIProvider, ProviderConfig, ModelInfo } from "./index.js";
import { OpenAIProvider } from "./providers/openai.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { OllamaProvider } from "./providers/ollama.js";
import { GoogleProvider } from "./providers/google.js";
import { DeepSeekProvider } from "./providers/deepseek.js";
import { QwenProvider } from "./providers/qwen.js";
import { GLMProvider } from "./providers/glm.js";
import { MoonshotProvider } from "./providers/moonshot.js";
import { MiniMaxProvider } from "./providers/minimax.js";
import { GroqProvider } from "./providers/groq.js";
import { TogetherProvider } from "./providers/together.js";
import { XAIProvider } from "./providers/xai.js";
import { loadConfig, applyConfigToEnv } from "./config.js";

export type ProviderId = string;

interface ProviderEntry {
  provider: AIProvider;
  config: ProviderConfig;
  enabled: boolean;
}

// ─── Provider Catalog (for interactive setup) ───

export interface ProviderCatalogEntry {
  id: string;
  name: string;
  envKey: string;
  baseUrl: string;
  region: string;
}

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  // China
  { id: "deepseek", name: "DeepSeek", envKey: "DEEPSEEK_API_KEY", baseUrl: "https://api.deepseek.com/v1", region: "China" },
  { id: "qwen", name: "Qwen (Tongyi)", envKey: "QWEN_API_KEY", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", region: "China" },
  { id: "glm", name: "GLM (Zhipu)", envKey: "GLM_API_KEY", baseUrl: "https://open.bigmodel.cn/api/paas/v4", region: "China" },
  { id: "moonshot", name: "Moonshot", envKey: "MOONSHOT_API_KEY", baseUrl: "https://api.moonshot.cn/v1", region: "China" },
  { id: "minimax", name: "MiniMax", envKey: "MINIMAX_API_KEY", baseUrl: "https://api.minimax.chat/v1", region: "China" },
  // US
  { id: "openai", name: "OpenAI", envKey: "OPENAI_API_KEY", baseUrl: "https://api.openai.com/v1", region: "US" },
  { id: "anthropic", name: "Anthropic", envKey: "ANTHROPIC_API_KEY", baseUrl: "https://api.anthropic.com", region: "US" },
  { id: "google", name: "Google (Gemini)", envKey: "GOOGLE_API_KEY", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", region: "US" },
  { id: "groq", name: "Groq", envKey: "GROQ_API_KEY", baseUrl: "https://api.groq.com/openai/v1", region: "US" },
  { id: "together", name: "Together AI", envKey: "TOGETHER_API_KEY", baseUrl: "https://api.together.xyz/v1", region: "US" },
  { id: "xai", name: "xAI (Grok)", envKey: "XAI_API_KEY", baseUrl: "https://api.x.ai/v1", region: "US" },
];

// ─── Provider Registry Class ───

class ProviderRegistry {
  private providers = new Map<ProviderId, ProviderEntry>();

  register(id: string, provider: AIProvider, config: ProviderConfig = {}): void {
    this.providers.set(id, { provider, config, enabled: true });
  }

  get(id: string): AIProvider | undefined {
    return this.providers.get(id)?.provider;
  }

  getAll(): AIProvider[] {
    return Array.from(this.providers.values())
      .filter((e) => e.enabled)
      .map((e) => e.provider);
  }

  getEnabled(): AIProvider[] {
    return this.getAll();
  }

  enable(id: string): void {
    const entry = this.providers.get(id);
    if (entry) entry.enabled = true;
  }

  disable(id: string): void {
    const entry = this.providers.get(id);
    if (entry) entry.enabled = false;
  }

  async getAllModels(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];
    for (const entry of this.providers.values()) {
      if (!entry.enabled) continue;
      for (const model of entry.provider.models) {
        models.push({ ...model, id: `${entry.provider.id}:${model.id}` });
      }
    }
    return models;
  }

  async getModelsForTask(taskType: string): Promise<ModelInfo[]> {
    const allModels = await this.getAllModels();
    return allModels.filter((m) =>
      m.capabilities.includes(taskType as never)
    );
  }

  async checkHealth(): Promise<Map<string, import("./index.js").ProviderHealth>> {
    const results = new Map<string, import("./index.js").ProviderHealth>();
    for (const [id, entry] of this.providers) {
      if (!entry.enabled) continue;
      try {
        const health = await entry.provider.getHealth();
        results.set(id, health);
      } catch {
        results.set(id, {
          provider: id,
          status: "unavailable",
          latencyMs: 0,
          lastChecked: new Date(),
          errorRate: 1,
        });
      }
    }
    return results;
  }
}

// Singleton registry
let globalRegistry: ProviderRegistry | null = null;

export function getProviderRegistry(): ProviderRegistry {
  if (!globalRegistry) {
    globalRegistry = new ProviderRegistry();
  }
  return globalRegistry;
}

/** Reset the singleton so autoConfigureRegistry() starts fresh */
export function resetProviderRegistry(): void {
  globalRegistry = null;
}

// ─── Create provider by type ───

export function createProvider(
  type: string,
  config: ProviderConfig = {}
): AIProvider {
  switch (type) {
    case "openai": return new OpenAIProvider(config);
    case "anthropic": return new AnthropicProvider(config);
    case "ollama": return new OllamaProvider(config);
    case "google": return new GoogleProvider(config);
    case "deepseek": return new DeepSeekProvider(config);
    case "qwen": return new QwenProvider(config);
    case "glm": return new GLMProvider(config);
    case "moonshot": return new MoonshotProvider(config);
    case "minimax": return new MiniMaxProvider(config);
    case "groq": return new GroqProvider(config);
    case "together": return new TogetherProvider(config);
    case "xai": return new XAIProvider(config);
    default: throw new Error(`Unknown provider type: ${type}`);
  }
}

// ─── Auto-configure from environment ───

export async function autoConfigureRegistry(): Promise<ProviderRegistry> {
  const registry = getProviderRegistry();

  // Load config file and apply to env vars (env takes precedence)
  const config = loadConfig();
  if (config) applyConfigToEnv(config);

  // Register cloud providers that have API keys
  if (process.env["OPENAI_API_KEY"] || process.env["OPENAI_BASE_URL"]) {
    registry.register("openai", new OpenAIProvider());
  }
  if (process.env["ANTHROPIC_API_KEY"]) {
    registry.register("anthropic", new AnthropicProvider());
  }
  if (process.env["GOOGLE_API_KEY"]) {
    registry.register("google", new GoogleProvider());
  }
  if (process.env["DEEPSEEK_API_KEY"]) {
    registry.register("deepseek", new DeepSeekProvider());
  }
  if (process.env["QWEN_API_KEY"]) {
    registry.register("qwen", new QwenProvider());
  }
  if (process.env["GLM_API_KEY"]) {
    registry.register("glm", new GLMProvider());
  }
  if (process.env["MOONSHOT_API_KEY"]) {
    registry.register("moonshot", new MoonshotProvider());
  }
  if (process.env["MINIMAX_API_KEY"]) {
    registry.register("minimax", new MiniMaxProvider());
  }
  if (process.env["GROQ_API_KEY"]) {
    registry.register("groq", new GroqProvider());
  }
  if (process.env["TOGETHER_API_KEY"]) {
    registry.register("together", new TogetherProvider());
  }
  if (process.env["XAI_API_KEY"]) {
    registry.register("xai", new XAIProvider());
  }

  // Ollama: only register if actually running
  try {
    const resp = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(2000) });
    if (resp.ok) {
      registry.register("ollama", new OllamaProvider());
    }
  } catch {
    // Ollama not running, skip
  }

  return registry;
}
