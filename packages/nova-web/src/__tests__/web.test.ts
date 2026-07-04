import { describe, it, expect } from "vitest";
import { getDashboardStats, generateRouterVisualization } from "../index.js";
import type { DashboardStats } from "../index.js";
import { AIRouter } from "@guiguzi/router";
import type { RouteEvent } from "@guiguzi/router";

describe("getDashboardStats", () => {
  it("should return stats for a fresh router", () => {
    const router = new AIRouter({ strategy: "hybrid" });
    const stats = getDashboardStats(router);

    expect(stats.totalRequests).toBe(0);
    expect(stats.dailyCost).toBe(0);
    expect(stats.activeAgents).toBe(0);
    expect(stats.recentEvents).toEqual([]);
  });

  it("should have correct shape", () => {
    const router = new AIRouter({ strategy: "static" });
    const stats = getDashboardStats(router);

    expect(stats).toHaveProperty("totalRequests");
    expect(stats).toHaveProperty("dailyCost");
    expect(stats).toHaveProperty("activeAgents");
    expect(stats).toHaveProperty("providerHealth");
    expect(stats).toHaveProperty("recentEvents");
    expect(typeof stats.totalRequests).toBe("number");
    expect(typeof stats.dailyCost).toBe("number");
  });

  it("should return empty providerHealth (TODO)", () => {
    const router = new AIRouter({ strategy: "hybrid" });
    const stats = getDashboardStats(router);
    expect(stats.providerHealth).toEqual({});
  });

  it("should limit recentEvents to last 50", () => {
    const router = new AIRouter({ strategy: "hybrid" });
    const stats = getDashboardStats(router);
    expect(stats.recentEvents.length).toBeLessThanOrEqual(50);
  });
});

describe("generateRouterVisualization", () => {
  it("should generate mermaid graph header", () => {
    const result = generateRouterVisualization([]);
    expect(result).toBe("graph LR");
  });

  it("should generate edges for decision events", () => {
    const events: RouteEvent[] = [
      {
        type: "decision",
        timestamp: new Date(),
        task: { type: "code", confidence: 0.9, keywords: [] },
        decision: {
          providerId: "openai",
          modelId: "gpt-4o",
          strategy: "hybrid",
          score: 8.5,
          reason: "best match",
          timestamp: new Date(),
          alternatives: [],
          model: {
            id: "gpt-4o",
            contextWindow: 128000,
            costPerMInput: 5,
            costPerMOutput: 15,
          },
        },
      },
    ];

    const result = generateRouterVisualization(events);
    expect(result).toContain("graph LR");
    expect(result).toContain("code");
    expect(result).toContain("gpt-4o");
    expect(result).toContain("8.5");
  });

  it("should skip non-decision events", () => {
    const events: RouteEvent[] = [
      {
        type: "fallback",
        timestamp: new Date(),
        reason: "timeout",
      },
    ];

    const result = generateRouterVisualization(events);
    expect(result).toBe("graph LR");
  });

  it("should only include last 10 decisions", () => {
    const events: RouteEvent[] = [];
    for (let i = 0; i < 15; i++) {
      events.push({
        type: "decision",
        timestamp: new Date(),
        task: { type: "code", confidence: 0.8, keywords: [] },
        decision: {
          providerId: "test",
          modelId: `model-${i}`,
          strategy: "hybrid",
          score: 5,
          reason: "test",
          timestamp: new Date(),
          alternatives: [],
          model: {
            id: `model-${i}`,
            contextWindow: 4096,
            costPerMInput: 1,
            costPerMOutput: 2,
          },
        },
      });
    }

    const result = generateRouterVisualization(events);
    const lines = result.split("\n");
    // First line is "graph LR", rest are edges (max 10)
    const edges = lines.slice(1);
    expect(edges.length).toBeLessThanOrEqual(10);
  });

  it("should sanitize model IDs for mermaid node IDs", () => {
    const events: RouteEvent[] = [
      {
        type: "decision",
        timestamp: new Date(),
        task: { type: "debug", confidence: 0.7, keywords: [] },
        decision: {
          providerId: "anthropic",
          modelId: "claude-4-opus",
          strategy: "task",
          score: 9,
          reason: "debug task",
          timestamp: new Date(),
          alternatives: [],
          model: {
            id: "claude-4-opus",
            contextWindow: 200000,
            costPerMInput: 15,
            costPerMOutput: 75,
          },
        },
      },
    ];

    const result = generateRouterVisualization(events);
    // Node ID should have colons and hyphens replaced with underscores
    expect(result).toContain("claude_4_opus");
    // But display label should keep original
    expect(result).toContain('"claude-4-opus"');
  });

  it("should skip decision events without task or decision", () => {
    const events: RouteEvent[] = [
      {
        type: "decision",
        timestamp: new Date(),
        // Missing task and decision
      },
    ];

    const result = generateRouterVisualization(events as RouteEvent[]);
    expect(result).toBe("graph LR");
  });
});
