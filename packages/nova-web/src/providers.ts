// ─── Provider Configuration ───
// Manages AI provider configurations and connectivity tests

import { randomUUID } from "node:crypto";

// ─── Interfaces ───────────────────────────────────────────────

export interface ProviderConfig {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  models: string[];
  config: Record<string, unknown>;
  addedAt: Date;
}

export interface ProviderConfigInput {
  type: string;
  name: string;
  apiKey?: string;
  baseUrl?: string;
  models?: string[];
  config?: Record<string, unknown>;
}

export interface ProviderTestResult {
  success: boolean;
  latencyMs: number;
  error?: string;
  models?: string[];
}

// ─── Provider Config Manager ──────────────────────────────────

export class ProviderConfigManager {
  private providers = new Map<string, ProviderConfig>();

  getProviders(): ProviderConfig[] {
    return Array.from(this.providers.values()).sort(
      (a, b) => b.addedAt.getTime() - a.addedAt.getTime(),
    );
  }

  addProvider(config: ProviderConfigInput): ProviderConfig {
    if (!config.type || !config.name) {
      throw new Error("Provider type and name are required");
    }

    const id = randomUUID();
    const provider: ProviderConfig = {
      id,
      type: config.type,
      name: config.name,
      enabled: true,
      models: config.models ?? [],
      config: {
        ...(config.config ?? {}),
        ...(config.apiKey ? { apiKey: config.apiKey } : {}),
        ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
      },
      addedAt: new Date(),
    };

    this.providers.set(id, provider);
    return provider;
  }

  updateProvider(
    id: string,
    updates: Partial<ProviderConfigInput>,
  ): ProviderConfig | null {
    const provider = this.providers.get(id);
    if (!provider) return null;

    if (updates.type !== undefined) provider.type = updates.type;
    if (updates.name !== undefined) provider.name = updates.name;
    if (updates.models !== undefined) provider.models = updates.models;

    if (updates.config !== undefined) {
      provider.config = { ...provider.config, ...updates.config };
    }
    if (updates.apiKey !== undefined) {
      provider.config.apiKey = updates.apiKey;
    }
    if (updates.baseUrl !== undefined) {
      provider.config.baseUrl = updates.baseUrl;
    }

    return provider;
  }

  removeProvider(id: string): boolean {
    return this.providers.delete(id);
  }

  async testProvider(id: string): Promise<ProviderTestResult> {
    const provider = this.providers.get(id);
    if (!provider) {
      return {
        success: false,
        latencyMs: 0,
        error: `Provider not found: ${id}`,
      };
    }

    const start = Date.now();

    try {
      // Simulate a connectivity test — in a real implementation this would
      // make an HTTP request to the provider's API endpoint.
      await new Promise<void>((resolve) => setTimeout(resolve, 50));

      const latencyMs = Date.now() - start;

      return {
        success: provider.enabled,
        latencyMs,
        models: provider.models.length > 0 ? provider.models : undefined,
        error: provider.enabled
          ? undefined
          : "Provider is disabled",
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
