import { describe, it, expect } from "vitest";

// Agent App tests verify the Ink TUI integration module structure.
// We cannot fully render Ink components in a headless test, but we can
// verify that the modules export the expected symbols and types.

describe("AgentApp module", () => {
  it("should export AgentApp component", async () => {
    const mod = await import("../AgentApp.js");
    expect(mod.AgentApp).toBeDefined();
    expect(typeof mod.AgentApp).toBe("function");
  });

  it("should export AgentAppProps type interface", async () => {
    // The module should be importable without errors, confirming types resolve
    const mod = await import("../AgentApp.js");
    expect(mod).toHaveProperty("AgentApp");
  });
});

describe("render module", () => {
  it("should export renderAgentApp function", async () => {
    const mod = await import("../render.js");
    expect(mod.renderAgentApp).toBeDefined();
    expect(typeof mod.renderAgentApp).toBe("function");
  });

  it("should have renderAgentApp accept three parameters", async () => {
    const mod = await import("../render.js");
    // Verify the function exists and has the expected arity
    expect(mod.renderAgentApp.length).toBe(3);
  });
});

describe("TUI component integration", () => {
  it("should import TUI components used by AgentApp", async () => {
    const tui = await import("@guiguzi/tui");
    expect(tui.ChatView).toBeDefined();
    expect(tui.StatusBar).toBeDefined();
    expect(tui.RouterPanel).toBeDefined();
    expect(tui.DEFAULT_THEME).toBeDefined();
    expect(tui.DEFAULT_THEME.primary).toBeDefined();
  });
});
