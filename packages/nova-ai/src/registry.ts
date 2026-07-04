// ─── Provider Registry ───
// Central registry for all AI providers

import type { AIProvider, ProviderConfig, ModelInfo } from "./index.js";
import { OpenAIProvider } from "./providers/openai.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { OllamaProvider } from "./providers/ollama.js";

export type ProviderId = string;

interface ProviderEntry {
  provider: AIProvider;
  config: ProviderConfig;
  enabled: boolean;
}

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

export function createProvider(
  type: "openai" | "anthropic" | "ollama",
  config: ProviderConfig = {}
): AIProvider {
  switch (type) {
    case "openai":
      return new OpenAIProvider(config);
    case "anthropic":
      return new AnthropicProvider(config);
    case "ollama":
      return new OllamaProvider(config);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}

// ─── Auto-configure from environment ───

export function autoConfigureRegistry(): ProviderRegistry {
  const registry = getProviderRegistry();

  if (process.env["OPENAI_API_KEY"] || process.env["OPENAI_BASE_URL"]) {
    registry.register("openai", new OpenAIProvider());
  }
  if (process.env["ANTHROPIC_API_KEY"]) {
    registry.register("anthropic", new AnthropicProvider());
  }
  // Ollama is always registered (local, no key needed)
  registry.register("ollama", new OllamaProvider());

  return registry;
}
