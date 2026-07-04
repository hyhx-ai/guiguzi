import { describe, it, expect } from "vitest";
import {
  DEFAULT_THEME,
  formatRouterDecision,
  formatHealthStatus,
} from "../index.js";
import type { Theme } from "../index.js";

describe("DEFAULT_THEME", () => {
  it("should have all required color fields", () => {
    const requiredKeys: (keyof Theme)[] = [
      "primary", "secondary", "accent", "background",
      "text", "textDim", "error", "success", "warning",
    ];
    for (const key of requiredKeys) {
      expect(DEFAULT_THEME[key]).toBeDefined();
      expect(typeof DEFAULT_THEME[key]).toBe("string");
    }
  });

  it("should use hex color strings", () => {
    const hexPattern = /^#[0-9a-f]{6}$/i;
    for (const value of Object.values(DEFAULT_THEME)) {
      expect(value).toMatch(hexPattern);
    }
  });

  it("should have distinct primary and secondary colors", () => {
    expect(DEFAULT_THEME.primary).not.toBe(DEFAULT_THEME.secondary);
  });

  it("should have dark background", () => {
    // Background should be a dark color (low hex values)
    const bg = DEFAULT_THEME.background;
    expect(bg).toBe("#0a0c10");
  });
});

describe("formatRouterDecision", () => {
  it("should format a basic decision", () => {
    const result = formatRouterDecision({
      providerId: "openai",
      modelId: "gpt-4o",
      strategy: "hybrid",
      score: 8.5,
      reason: "best overall match",
    });
    expect(result).toBe("[hybrid] → openai:gpt-4o (score: 8.5) best overall match");
  });

  it("should round score to one decimal place", () => {
    const result = formatRouterDecision({
      providerId: "anthropic",
      modelId: "claude-4-opus",
      strategy: "cost",
      score: 7.12345,
      reason: "cheapest option",
    });
    expect(result).toContain("7.1");
    expect(result).not.toContain("7.12");
  });

  it("should handle zero score", () => {
    const result = formatRouterDecision({
      providerId: "ollama",
      modelId: "llama4",
      strategy: "static",
      score: 0,
      reason: "forced",
    });
    expect(result).toContain("score: 0.0");
  });

  it("should include strategy name in brackets", () => {
    const strategies = ["static", "task", "cost", "failover", "hybrid"];
    for (const strategy of strategies) {
      const result = formatRouterDecision({
        providerId: "test",
        modelId: "model",
        strategy,
        score: 5,
        reason: "test",
      });
      expect(result).toMatch(new RegExp(`^\\[${strategy}\\]`));
    }
  });

  it("should include provider:model binding", () => {
    const result = formatRouterDecision({
      providerId: "anthropic",
      modelId: "claude-4-sonnet",
      strategy: "hybrid",
      score: 9,
      reason: "top pick",
    });
    expect(result).toContain("anthropic:claude-4-sonnet");
  });
});

describe("formatHealthStatus", () => {
  it("should format healthy status", () => {
    expect(formatHealthStatus("healthy")).toBe("✓ healthy");
  });

  it("should format degraded status", () => {
    expect(formatHealthStatus("degraded")).toBe("⚠ degraded");
  });

  it("should format unavailable status", () => {
    expect(formatHealthStatus("unavailable")).toBe("✗ unavailable");
  });

  it("should return a string for all valid statuses", () => {
    const statuses: Array<"healthy" | "degraded" | "unavailable"> = [
      "healthy", "degraded", "unavailable",
    ];
    for (const status of statuses) {
      const result = formatHealthStatus(status);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    }
  });
});
