import { describe, it, expect } from "vitest";
import {
  DEFAULT_THEME,
  formatRouterDecision,
  formatHealthStatus,
} from "../index.js";
import type { Theme } from "../index.js";

describe("DEFAULT_THEME (component integration)", () => {
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
    expect(DEFAULT_THEME.background).toBe("#0a0c10");
  });

  it("should be usable as a default theme reference for components", () => {
    // Verify the theme object shape matches what components expect
    expect(DEFAULT_THEME).toMatchObject({
      primary: expect.any(String),
      secondary: expect.any(String),
      accent: expect.any(String),
      background: expect.any(String),
      text: expect.any(String),
      textDim: expect.any(String),
      error: expect.any(String),
      success: expect.any(String),
      warning: expect.any(String),
    });
  });
});

describe("formatRouterDecision (used by RouterPanel)", () => {
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

describe("formatHealthStatus (used by RouterPanel)", () => {
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

describe("component exports", () => {
  it("should export ChatView component", async () => {
    const mod = await import("../index.js");
    expect(mod.ChatView).toBeDefined();
    expect(typeof mod.ChatView).toBe("function");
  });

  it("should export StatusBar component", async () => {
    const mod = await import("../index.js");
    expect(mod.StatusBar).toBeDefined();
    expect(typeof mod.StatusBar).toBe("function");
  });

  it("should export RouterPanel component", async () => {
    const mod = await import("../index.js");
    expect(mod.RouterPanel).toBeDefined();
    expect(typeof mod.RouterPanel).toBe("function");
  });
});
