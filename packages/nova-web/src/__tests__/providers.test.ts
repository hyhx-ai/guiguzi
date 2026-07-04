import { describe, it, expect, beforeEach } from "vitest";
import { ProviderConfigManager } from "../providers.js";
import type { ProviderConfigInput } from "../providers.js";

function makeInput(overrides: Partial<ProviderConfigInput> = {}): ProviderConfigInput {
  return {
    type: "openai",
    name: "Test Provider",
    ...overrides,
  };
}

describe("ProviderConfigManager", () => {
  let manager: ProviderConfigManager;

  beforeEach(() => {
    manager = new ProviderConfigManager();
  });

  // ── addProvider ────────────────────────────────────────────

  it("should add a provider with a unique ID", () => {
    const p = manager.addProvider(makeInput());
    expect(p.id).toBeDefined();
    expect(typeof p.id).toBe("string");
    expect(p.id.length).toBeGreaterThan(0);
  });

  it("should set default values for a new provider", () => {
    const p = manager.addProvider(makeInput({ name: "My Provider" }));
    expect(p.name).toBe("My Provider");
    expect(p.type).toBe("openai");
    expect(p.enabled).toBe(true);
    expect(p.models).toEqual([]);
    expect(p.addedAt).toBeInstanceOf(Date);
  });

  it("should store apiKey and baseUrl in config", () => {
    const p = manager.addProvider(
      makeInput({ apiKey: "sk-test", baseUrl: "https://api.example.com" }),
    );
    expect(p.config.apiKey).toBe("sk-test");
    expect(p.config.baseUrl).toBe("https://api.example.com");
  });

  it("should store custom models", () => {
    const p = manager.addProvider(
      makeInput({ models: ["gpt-4", "gpt-3.5-turbo"] }),
    );
    expect(p.models).toEqual(["gpt-4", "gpt-3.5-turbo"]);
  });

  it("should throw when type or name is missing", () => {
    expect(() => manager.addProvider(makeInput({ type: "" }))).toThrow("type and name are required");
    expect(() => manager.addProvider(makeInput({ name: "" }))).toThrow("type and name are required");
  });

  it("should generate unique IDs for multiple providers", () => {
    const p1 = manager.addProvider(makeInput({ name: "A" }));
    const p2 = manager.addProvider(makeInput({ name: "B" }));
    expect(p1.id).not.toBe(p2.id);
  });

  // ── getProviders ───────────────────────────────────────────

  it("should return an empty array initially", () => {
    expect(manager.getProviders()).toEqual([]);
  });

  it("should list all added providers", () => {
    manager.addProvider(makeInput({ name: "A" }));
    manager.addProvider(makeInput({ name: "B" }));
    const providers = manager.getProviders();
    expect(providers).toHaveLength(2);
  });

  it("should return all providers from getProviders", () => {
    const p1 = manager.addProvider(makeInput({ name: "First" }));
    const p2 = manager.addProvider(makeInput({ name: "Second" }));
    const providers = manager.getProviders();
    expect(providers).toHaveLength(2);
    const names = providers.map((p) => p.name);
    expect(names).toContain("First");
    expect(names).toContain("Second");
  });

  // ── updateProvider ─────────────────────────────────────────

  it("should update provider name", () => {
    const p = manager.addProvider(makeInput({ name: "Old Name" }));
    const updated = manager.updateProvider(p.id, { name: "New Name" });
    expect(updated).not.toBeNull();
    expect(updated!.name).toBe("New Name");
  });

  it("should update provider type", () => {
    const p = manager.addProvider(makeInput({ type: "openai" }));
    const updated = manager.updateProvider(p.id, { type: "anthropic" });
    expect(updated!.type).toBe("anthropic");
  });

  it("should update models", () => {
    const p = manager.addProvider(makeInput());
    const updated = manager.updateProvider(p.id, { models: ["claude-3-opus"] });
    expect(updated!.models).toEqual(["claude-3-opus"]);
  });

  it("should update apiKey in config", () => {
    const p = manager.addProvider(makeInput({ apiKey: "old-key" }));
    const updated = manager.updateProvider(p.id, { apiKey: "new-key" });
    expect(updated!.config.apiKey).toBe("new-key");
  });

  it("should merge config without losing existing keys", () => {
    const p = manager.addProvider(makeInput({ config: { timeout: 5000 } }));
    const updated = manager.updateProvider(p.id, { config: { retries: 3 } });
    expect(updated!.config.timeout).toBe(5000);
    expect(updated!.config.retries).toBe(3);
  });

  it("should return null when updating a non-existent provider", () => {
    const result = manager.updateProvider("non-existent", { name: "X" });
    expect(result).toBeNull();
  });

  // ── removeProvider ─────────────────────────────────────────

  it("should remove an existing provider", () => {
    const p = manager.addProvider(makeInput());
    const result = manager.removeProvider(p.id);
    expect(result).toBe(true);
    expect(manager.getProviders()).toHaveLength(0);
  });

  it("should return false when removing a non-existent provider", () => {
    expect(manager.removeProvider("non-existent")).toBe(false);
  });

  // ── testProvider ───────────────────────────────────────────

  it("should return a successful test result for an enabled provider", async () => {
    const p = manager.addProvider(makeInput());
    const result = await manager.testProvider(p.id);
    expect(result.success).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });

  it("should return models in test result when available", async () => {
    const p = manager.addProvider(makeInput({ models: ["gpt-4"] }));
    const result = await manager.testProvider(p.id);
    expect(result.models).toEqual(["gpt-4"]);
  });

  it("should return error for a non-existent provider", async () => {
    const result = await manager.testProvider("non-existent");
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("should return latency in milliseconds", async () => {
    const p = manager.addProvider(makeInput());
    const result = await manager.testProvider(p.id);
    expect(typeof result.latencyMs).toBe("number");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
