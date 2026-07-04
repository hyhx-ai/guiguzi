// ─── Health Monitor ───
// Tracks provider health and manages failover decisions

import type { AIProvider, ProviderHealth } from "@guiguzi/ai";

export interface HealthThresholds {
  maxLatencyMs: number;
  maxErrorRate: number;
  checkIntervalMs: number;
  consecutiveFailures: number;
}

const DEFAULT_THRESHOLDS: HealthThresholds = {
  maxLatencyMs: 30000,
  maxErrorRate: 0.5,
  checkIntervalMs: 60000,
  consecutiveFailures: 3,
};

export class HealthMonitor {
  private health = new Map<string, ProviderHealth>();
  private failureCounts = new Map<string, number>();
  private thresholds: HealthThresholds;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private providers: AIProvider[] = [];

  constructor(thresholds?: Partial<HealthThresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  startMonitoring(providers: AIProvider[]): void {
    this.providers = providers;
    this.stopMonitoring();
    this.checkInterval = setInterval(() => {
      void this.checkAll();
    }, this.thresholds.checkIntervalMs);
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  async checkAll(): Promise<Map<string, ProviderHealth>> {
    const results = new Map<string, ProviderHealth>();

    await Promise.allSettled(
      this.providers.map(async (provider) => {
        try {
          const health = await provider.getHealth();
          this.health.set(provider.id, health);
          results.set(provider.id, health);

          // Track consecutive failures
          if (health.status === "unavailable") {
            const count = (this.failureCounts.get(provider.id) ?? 0) + 1;
            this.failureCounts.set(provider.id, count);
          } else {
            this.failureCounts.set(provider.id, 0);
          }
        } catch {
          const health: ProviderHealth = {
            provider: provider.id,
            status: "unavailable",
            latencyMs: 0,
            lastChecked: new Date(),
            errorRate: 1,
          };
          this.health.set(provider.id, health);
          results.set(provider.id, health);
        }
      })
    );

    return results;
  }

  getHealth(providerId: string): ProviderHealth | undefined {
    return this.health.get(providerId);
  }

  getAllHealth(): Map<string, ProviderHealth> {
    return new Map(this.health);
  }

  isHealthy(providerId: string): boolean {
    const health = this.health.get(providerId);
    if (!health) return true; // Assume healthy if no data

    const failures = this.failureCounts.get(providerId) ?? 0;
    if (failures >= this.thresholds.consecutiveFailures) return false;
    if (health.status === "unavailable") return false;
    if (health.errorRate > this.thresholds.maxErrorRate) return false;
    if (health.latencyMs > this.thresholds.maxLatencyMs && health.latencyMs > 0) return false;

    return true;
  }

  getHealthyProviders(): string[] {
    return Array.from(this.health.keys()).filter((id) => this.isHealthy(id));
  }

  recordFailure(providerId: string): void {
    const count = (this.failureCounts.get(providerId) ?? 0) + 1;
    this.failureCounts.set(providerId, count);
  }

  recordSuccess(providerId: string): void {
    this.failureCounts.set(providerId, 0);
  }
}
