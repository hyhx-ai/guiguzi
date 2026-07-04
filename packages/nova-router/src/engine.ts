// ─── AI Router Engine ───
// The core routing decision engine with 5 strategies

import type { AIProvider, ModelInfo, TaskClassification, Message } from "@guiguzi/ai";
import { classifyTask, getProviderRegistry } from "@guiguzi/ai";
import { HealthMonitor } from "./health.js";
import type {
  RoutingPolicy, RoutingDecision, RoutingAlternative,
  RoutingWeights, RouteEvent, BudgetConfig,
} from "./types.js";

const DEFAULT_WEIGHTS: RoutingWeights = {
  quality: 0.4,
  cost: 0.2,
  speed: 0.3,
  availability: 0.1,
};

export class AIRouter {
  private policy: RoutingPolicy;
  private healthMonitor: HealthMonitor;
  private providers: AIProvider[] = [];
  private eventLog: RouteEvent[] = [];
  private dailySpent = 0;
  private lastResetDate = new Date();

  constructor(policy: RoutingPolicy) {
    this.policy = policy;
    this.healthMonitor = new HealthMonitor();
  }

  // ─── Initialization ───

  async initialize(): Promise<void> {
    const registry = getProviderRegistry();
    this.providers = registry.getEnabled();
    this.healthMonitor.startMonitoring(this.providers);
    await this.healthMonitor.checkAll();
  }

  shutdown(): void {
    this.healthMonitor.stopMonitoring();
  }

  // ─── Core Routing ───

  async route(messages: Message[]): Promise<RoutingDecision> {
    this.resetDailyBudgetIfNeeded();

    // Classify the task
    const task = classifyTask(messages);

    // Get all available models
    const allModels = await this.getAllAvailableModels();

    // Filter models that support this task type
    const compatibleModels = allModels.filter(
      (m) => m.capabilities.includes(task.type) || task.type === "simple"
    );

    // Apply strategy
    let decision: RoutingDecision;
    switch (this.policy.strategy) {
      case "static":
        decision = this.staticRoute(compatibleModels);
        break;
      case "task":
        decision = this.taskRoute(compatibleModels, task);
        break;
      case "cost":
        decision = this.costRoute(compatibleModels, task);
        break;
      case "failover":
        decision = this.failoverRoute(compatibleModels);
        break;
      case "hybrid":
        decision = this.hybridRoute(compatibleModels, task);
        break;
      default:
        decision = this.hybridRoute(compatibleModels, task);
    }

    // Check budget constraints
    if (this.policy.budget) {
      decision = this.applyBudgetConstraints(decision);
    }

    // Check health
    if (!this.healthMonitor.isHealthy(decision.providerId)) {
      decision = await this.applyFailover(decision);
    }

    // Log event
    this.logEvent({
      type: "decision",
      timestamp: new Date(),
      task,
      decision,
    });

    return decision;
  }

  // ─── Strategy: Static ───

  private staticRoute(models: ModelInfo[]): RoutingDecision {
    const binding = this.policy.bindings?.[0];
    if (binding) {
      const model = models.find(
        (m) => m.id === `${binding.providerId}:${binding.modelId}`
      );
      if (model) {
        return this.buildDecision(binding.providerId, binding.modelId, model, "Static binding match", models);
      }
    }

    // Fallback to first available
    const first = models[0];
    if (first) {
      const [providerId] = first.id.split(":");
      return this.buildDecision(providerId!, first.id, first, "Static fallback to first available", models);
    }

    return this.fallbackDecision();
  }

  // ─── Strategy: Task-Aware ───

  private taskRoute(models: ModelInfo[], task: TaskClassification): RoutingDecision {
    // Select model with highest quality for this task type
    const sorted = [...models].sort((a, b) => b.quality - a.quality);
    const best = sorted[0];

    if (!best) return this.fallbackDecision();

    const [providerId] = best.id.split(":");
    return this.buildDecision(
      providerId!,
      best.id,
      best,
      `Task "${task.type}" → highest quality model (score: ${best.quality})`,
      models,
      (m) => ({ score: m.quality, reason: `Quality: ${m.quality}` })
    );
  }

  // ─── Strategy: Cost-Optimized ───

  private costRoute(models: ModelInfo[], task: TaskClassification): RoutingDecision {
    // Prefer local models if configured
    if (this.policy.budget?.preferLocal) {
      const local = models.find((m) => m.costPerMInput === 0);
      if (local) {
        const [providerId] = local.id.split(":");
        return this.buildDecision(
          providerId!,
          local.id,
          local,
          "Local model selected (free)",
          models
        );
      }
    }

    // Select model with lowest cost
    const sorted = [...models].sort(
      (a, b) => (a.costPerMInput + a.costPerMOutput) - (b.costPerMInput + b.costPerMOutput)
    );
    const cheapest = sorted[0];

    if (!cheapest) return this.fallbackDecision();

    const [providerId] = cheapest.id.split(":");
    return this.buildDecision(
      providerId!,
      cheapest.id,
      cheapest,
      `Lowest cost for "${task.type}" ($${cheapest.costPerMInput}/M input)`,
      models,
      (m) => ({
        score: 100 - (m.costPerMInput + m.costPerMOutput),
        reason: `Cost: $${m.costPerMInput}/M`,
      })
    );
  }

  // ─── Strategy: Failover-First ───

  private failoverRoute(models: ModelInfo[]): RoutingDecision {
    const chain = this.policy.failoverChain ?? [];

    for (const entry of chain) {
      if (this.healthMonitor.isHealthy(entry.providerId)) {
        const model = models.find(
          (m) => m.id === `${entry.providerId}:${entry.modelId}`
        );
        if (model) {
          return this.buildDecision(
            entry.providerId,
            model.id,
            model,
            "Failover chain: first healthy provider",
            models
          );
        }
      }
    }

    // All chain entries failed, use fallback
    return this.fallbackDecision();
  }

  // ─── Strategy: Hybrid (Multi-Dimensional Scoring) ───

  private hybridRoute(models: ModelInfo[], task: TaskClassification): RoutingDecision {
    const weights = this.policy.weights ?? DEFAULT_WEIGHTS;
    const healthMap = this.healthMonitor.getAllHealth();

    const scored = models.map((model) => {
      const health = healthMap.get(model.id.split(":")[0]!);
      const availability = health
        ? (health.status === "healthy" ? 100 : health.status === "degraded" ? 50 : 0)
        : 50;

      // Normalize cost to 0-100 scale (lower cost = higher score)
      const maxCost = 20; // $20/M is the reference max
      const costScore = Math.max(0, 100 - ((model.costPerMInput + model.costPerMOutput) / maxCost) * 100);

      const score =
        model.quality * weights.quality +
        costScore * weights.cost +
        model.speed * weights.speed +
        availability * weights.availability;

      return { model, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    if (!best) return this.fallbackDecision();

    const [providerId] = best.model.id.split(":");
    return this.buildDecision(
      providerId!,
      best.model.id,
      best.model,
      `Hybrid score: ${best.score.toFixed(1)} (Q:${(best.model.quality * weights.quality).toFixed(1)} C:${(Math.max(0, 100 - ((best.model.costPerMInput + best.model.costPerMOutput) / 20) * 100) * weights.cost).toFixed(1)} S:${(best.model.speed * weights.speed).toFixed(1)} A:${((healthMap.get(providerId!)?.status === "healthy" ? 100 : 50) * weights.availability).toFixed(1)})`,
      models,
      (m) => {
        const s = scored.find((x) => x.model.id === m.id);
        return { score: s?.score ?? 0, reason: `Score: ${(s?.score ?? 0).toFixed(1)}` };
      }
    );
  }

  // ─── Budget Constraints ───

  private applyBudgetConstraints(decision: RoutingDecision): RoutingDecision {
    const budget = this.policy.budget;
    if (!budget) return decision;

    // Check daily limit
    if (budget.dailyLimitUsd && this.dailySpent >= budget.dailyLimitUsd) {
      this.logEvent({
        type: "budget_exceeded",
        timestamp: new Date(),
        reason: `Daily budget exceeded: $${this.dailySpent.toFixed(2)} / $${budget.dailyLimitUsd}`,
      });

      // Switch to cheapest/free model
      if (budget.preferLocal) {
        const allModels = this.getAllModelsSync();
        const free = allModels.find((m) => m.costPerMInput === 0);
        if (free) {
          const [providerId] = free.id.split(":");
          return this.buildDecision(providerId!, free.id, free, "Budget exceeded → local fallback", allModels);
        }
      }
    }

    // Check per-model cost limit
    if (budget.maxCostPerMToken) {
      const costCap = budget.maxCostPerMToken;
      const totalCost = decision.model.costPerMInput + decision.model.costPerMOutput;
      if (totalCost > costCap) {
        // Find cheaper alternative
        const allModels = this.getAllModelsSync();
        const cheaper = allModels
          .filter((m) => (m.costPerMInput + m.costPerMOutput) <= costCap)
          .sort((a, b) => (a.costPerMInput + a.costPerMOutput) - (b.costPerMInput + b.costPerMOutput));

        if (cheaper[0]) {
          const [providerId] = cheaper[0].id.split(":");
          return this.buildDecision(providerId!, cheaper[0].id, cheaper[0], "Cost cap exceeded → cheaper model", allModels);
        }
      }
    }

    return decision;
  }

  // ─── Failover ───

  private async applyFailover(decision: RoutingDecision): Promise<RoutingDecision> {
    const originalProvider = decision.providerId;
    const allModels = this.getAllModelsSync();

    // Try failover chain
    const chain = this.policy.failoverChain ?? [];
    for (const entry of chain) {
      if (this.healthMonitor.isHealthy(entry.providerId) && entry.providerId !== originalProvider) {
        const model = allModels.find(
          (m) => m.id === `${entry.providerId}:${entry.modelId}`
        );
        if (model) {
          this.logEvent({
            type: "failover",
            timestamp: new Date(),
            from: { providerId: originalProvider, modelId: decision.modelId },
            to: { providerId: entry.providerId, modelId: model.id },
            reason: `Provider ${originalProvider} unhealthy`,
          });

          return this.buildDecision(entry.providerId, model.id, model, "Failover: original unhealthy", allModels);
        }
      }
    }

    // Try any healthy provider with same capabilities
    const healthyProviders = this.healthMonitor.getHealthyProviders();
    const alternative = allModels.find(
      (m) =>
        healthyProviders.includes(m.id.split(":")[0]!) &&
        m.capabilities.some((c) => decision.model.capabilities.includes(c)) &&
        m.id !== decision.modelId
    );

    if (alternative) {
      const [providerId] = alternative.id.split(":");
      this.logEvent({
        type: "failover",
        timestamp: new Date(),
        from: { providerId: originalProvider, modelId: decision.modelId },
        to: { providerId: providerId!, modelId: alternative.id },
        reason: `Provider ${originalProvider} unhealthy → alternative`,
      });
      return this.buildDecision(providerId!, alternative.id, alternative, "Failover: alternative healthy provider", allModels);
    }

    // Use fallback
    if (this.policy.fallback) {
      const fallbackModel = allModels.find((m) => m.id === this.policy!.fallback);
      if (fallbackModel) {
        const [providerId] = fallbackModel.id.split(":");
        this.logEvent({
          type: "fallback",
          timestamp: new Date(),
          from: { providerId: originalProvider, modelId: decision.modelId },
          to: { providerId: providerId!, modelId: fallbackModel.id },
          reason: "All providers unhealthy → fallback",
        });
        return this.buildDecision(providerId!, fallbackModel.id, fallbackModel, "Fallback model", allModels);
      }
    }

    return decision; // Return original as last resort
  }

  // ─── Helpers ───

  private buildDecision(
    providerId: string,
    modelId: string,
    model: ModelInfo,
    reason: string,
    allModels: ModelInfo[],
    scoreFn?: (m: ModelInfo) => { score: number; reason: string }
  ): RoutingDecision {
    const alternatives: RoutingAlternative[] = allModels
      .filter((m) => m.id !== modelId)
      .slice(0, 5)
      .map((m) => {
        const scored = scoreFn ? scoreFn(m) : { score: m.quality, reason: `Quality: ${m.quality}` };
        const [pid] = m.id.split(":");
        return {
          providerId: pid!,
          modelId: m.id,
          model: m,
          score: scored.score,
          reason: scored.reason,
        };
      })
      .sort((a, b) => b.score - a.score);

    const score = scoreFn
      ? scoreFn(model).score
      : model.quality * 0.4 + Math.max(0, 100 - (model.costPerMInput + model.costPerMOutput) / 20 * 100) * 0.2 + model.speed * 0.3 + 100 * 0.1;

    return {
      providerId,
      modelId,
      model,
      strategy: this.policy.strategy,
      score,
      reason,
      alternatives,
      timestamp: new Date(),
    };
  }

  private fallbackDecision(): RoutingDecision {
    return {
      providerId: "none",
      modelId: "none",
      model: {
        id: "none",
        name: "No Model Available",
        contextWindow: 0,
        costPerMInput: 0,
        costPerMOutput: 0,
        capabilities: [],
        quality: 0,
        speed: 0,
      },
      strategy: this.policy.strategy,
      score: 0,
      reason: "No compatible models available",
      alternatives: [],
      timestamp: new Date(),
    };
  }

  private async getAllAvailableModels(): Promise<ModelInfo[]> {
    const registry = getProviderRegistry();
    return registry.getAllModels();
  }

  private getAllModelsSync(): ModelInfo[] {
    const models: ModelInfo[] = [];
    for (const provider of this.providers) {
      for (const model of provider.models) {
        models.push({ ...model, id: `${provider.id}:${model.id}` });
      }
    }
    return models;
  }

  private resetDailyBudgetIfNeeded(): void {
    const now = new Date();
    if (now.getDate() !== this.lastResetDate.getDate()) {
      this.dailySpent = 0;
      this.lastResetDate = now;
    }
  }

  private logEvent(event: RouteEvent): void {
    this.eventLog.push(event);
    // Keep only last 1000 events
    if (this.eventLog.length > 1000) {
      this.eventLog = this.eventLog.slice(-1000);
    }
  }

  // ─── Public API ───

  getEventLog(): RouteEvent[] {
    return [...this.eventLog];
  }

  getPolicy(): RoutingPolicy {
    return { ...this.policy };
  }

  updatePolicy(patch: Partial<RoutingPolicy>): void {
    this.policy = { ...this.policy, ...patch };
  }

  recordCost(usd: number): void {
    this.dailySpent += usd;
  }

  getDailySpent(): number {
    return this.dailySpent;
  }
}
