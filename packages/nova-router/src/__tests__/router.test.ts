import { describe, it, expect, beforeEach } from "vitest";
import { AIRouter } from "../engine.js";
import { HealthMonitor } from "../health.js";
import type { RoutingPolicy } from "../types.js";

describe("AIRouter", () => {
  it("should create with hybrid strategy", () => {
    const router = new AIRouter({ strategy: "hybrid" });
    expect(router.getPolicy().strategy).toBe("hybrid");
  });

  it("should create with all strategy types", () => {
    const strategies = ["static", "task", "cost", "failover", "hybrid"] as const;
    for (const strategy of strategies) {
      const router = new AIRouter({ strategy });
      expect(router.getPolicy().strategy).toBe(strategy);
    }
  });

  it("should track daily spending", () => {
    const router = new AIRouter({ strategy: "cost" });
    expect(router.getDailySpent()).toBe(0);
    router.recordCost(0.05);
    expect(router.getDailySpent()).toBe(0.05);
    router.recordCost(0.03);
    expect(router.getDailySpent()).toBeCloseTo(0.08);
  });

  it("should update policy", () => {
    const router = new AIRouter({ strategy: "static" });
    router.updatePolicy({ strategy: "hybrid" });
    expect(router.getPolicy().strategy).toBe("hybrid");
  });

  it("should return event log", () => {
    const router = new AIRouter({ strategy: "hybrid" });
    expect(router.getEventLog()).toEqual([]);
  });

  it("should shutdown cleanly", () => {
    const router = new AIRouter({ strategy: "hybrid" });
    expect(() => router.shutdown()).not.toThrow();
  });
});

describe("HealthMonitor", () => {
  it("should create without errors", () => {
    const monitor = new HealthMonitor();
    expect(monitor).toBeTruthy();
  });

  it("should report no providers initially", () => {
    const monitor = new HealthMonitor();
    const healthy = monitor.getHealthyProviders();
    expect(healthy).toEqual([]);
  });

  it("should stop monitoring cleanly", () => {
    const monitor = new HealthMonitor();
    expect(() => monitor.stopMonitoring()).not.toThrow();
  });
});

describe("RoutingPolicy types", () => {
  it("should accept static bindings", () => {
    const policy: RoutingPolicy = {
      strategy: "static",
      bindings: [{ providerId: "openai", modelId: "gpt-4o" }],
    };
    const router = new AIRouter(policy);
    expect(router.getPolicy().bindings).toHaveLength(1);
  });

  it("should accept budget config", () => {
    const policy: RoutingPolicy = {
      strategy: "cost",
      budget: {
        dailyLimitUsd: 10,
        maxCostPerMToken: 5,
        preferLocal: true,
      },
    };
    const router = new AIRouter(policy);
    expect(router.getPolicy().budget?.dailyLimitUsd).toBe(10);
  });

  it("should accept failover chain", () => {
    const policy: RoutingPolicy = {
      strategy: "failover",
      failoverChain: [
        { providerId: "anthropic", modelId: "claude-4-sonnet" },
        { providerId: "openai", modelId: "gpt-4o" },
        { providerId: "ollama", modelId: "llama3" },
      ],
    };
    const router = new AIRouter(policy);
    expect(router.getPolicy().failoverChain).toHaveLength(3);
  });

  it("should accept custom weights for hybrid", () => {
    const policy: RoutingPolicy = {
      strategy: "hybrid",
      weights: { quality: 0.5, cost: 0.1, speed: 0.3, availability: 0.1 },
    };
    const router = new AIRouter(policy);
    expect(router.getPolicy().weights?.quality).toBe(0.5);
  });
});
