import { describe, it, expect } from "vitest";
import { Gateway } from "../index.js";
import type { GatewayConfig, ChannelConfig, ChannelBinding, GatewayMessage } from "../index.js";

function makeConfig(overrides: Partial<GatewayConfig> = {}): GatewayConfig {
  return {
    port: 18789,
    channels: [],
    routerPolicy: { strategy: "hybrid" },
    ...overrides,
  };
}

describe("Gateway", () => {
  it("should construct with minimal config", () => {
    const gw = new Gateway(makeConfig());
    expect(gw).toBeDefined();
  });

  it("should construct with channels", () => {
    const gw = new Gateway(makeConfig({
      channels: [
        {
          type: "web",
          name: "web-ui",
          config: {},
          bindings: [{ agentId: "default" }],
        },
      ],
    }));
    expect(gw).toBeDefined();
  });

  it("should construct with multiple channels", () => {
    const gw = new Gateway(makeConfig({
      channels: [
        { type: "feishu", name: "feishu-bot", config: {}, bindings: [] },
        { type: "slack", name: "slack-bot", config: {}, bindings: [] },
        { type: "discord", name: "discord-bot", config: {}, bindings: [] },
        { type: "web", name: "web-ui", config: {}, bindings: [] },
      ],
    }));
    expect(gw).toBeDefined();
  });

  it("should accept custom host", () => {
    const gw = new Gateway(makeConfig({ host: "127.0.0.1" }));
    expect(gw).toBeDefined();
  });

  it("should accept different router strategies", () => {
    const strategies = ["static", "task", "cost", "failover", "hybrid"] as const;
    for (const strategy of strategies) {
      const gw = new Gateway(makeConfig({
        routerPolicy: { strategy },
      }));
      expect(gw).toBeDefined();
    }
  });

  it("should shutdown cleanly", async () => {
    const gw = new Gateway(makeConfig());
    await gw.stop();
    // Should not throw
  });
});

describe("ChannelConfig types", () => {
  it("should support all channel types", () => {
    const types: ChannelConfig["type"][] = ["feishu", "slack", "discord", "web"];
    for (const type of types) {
      const channel: ChannelConfig = {
        type,
        name: `test-${type}`,
        config: {},
        bindings: [],
      };
      expect(channel.type).toBe(type);
    }
  });
});

describe("ChannelBinding", () => {
  it("should support group peer binding", () => {
    const binding: ChannelBinding = {
      peer: { kind: "group", id: "group-123" },
      agentId: "code-agent",
    };
    expect(binding.peer?.kind).toBe("group");
  });

  it("should support user peer binding", () => {
    const binding: ChannelBinding = {
      peer: { kind: "user", id: "user-456" },
      channel: "general",
      agentId: "default",
    };
    expect(binding.peer?.kind).toBe("user");
  });

  it("should work without peer (catch-all)", () => {
    const binding: ChannelBinding = {
      agentId: "default",
    };
    expect(binding.peer).toBeUndefined();
  });
});

describe("GatewayMessage", () => {
  it("should represent a message", () => {
    const msg: GatewayMessage = {
      id: "msg-001",
      channel: "feishu",
      peer: { kind: "group", id: "g-1" },
      content: "Hello NovaClaw",
      sender: "user-1",
      timestamp: new Date("2026-01-01T00:00:00Z"),
    };
    expect(msg.id).toBe("msg-001");
    expect(msg.channel).toBe("feishu");
    expect(msg.content).toBe("Hello NovaClaw");
    expect(msg.timestamp).toBeInstanceOf(Date);
  });
});
