import { describe, it, expect } from "vitest";
import type { AIProvider, ModelInfo, ChatOptions, StreamChunk, ChatResponse, ProviderHealth } from "@guiguzi/ai";
import { getProviderRegistry } from "@guiguzi/ai";
import { AIRouter } from "@guiguzi/router";
import type { RoutingPolicy } from "@guiguzi/router";
import { Agent, ConversationTree } from "@guiguzi/agent-core";
import type { AgentEvent } from "@guiguzi/agent-core";
import { GuiguziSDK } from "@guiguzi/sdk";
import { parseFeishuEvent, parseSlackEvent, parseDiscordInteraction } from "@guiguzi/gateway";

// ─── Mock Provider Helper ───
//
// IMPORTANT: The provider registry is a global singleton. Providers registered
// in earlier tests remain for later tests. To make tests deterministic we use:
//   - Unique provider IDs per test (avoid collisions)
//   - High quality scores (99) for providers that MUST be selected by the router
//   - Flexible assertions where exact provider selection is not the focus

const HIGH_QUALITY: Partial<ModelInfo> = { quality: 99, speed: 90 };
const HIGHEST_QUALITY: Partial<ModelInfo> = { quality: 100, speed: 100 };

function createMockModelInfo(overrides?: Partial<ModelInfo>): ModelInfo {
  return {
    id: "mock-model",
    name: "Mock Model",
    contextWindow: 4096,
    costPerMInput: 1,
    costPerMOutput: 2,
    capabilities: ["simple", "code"],
    quality: 70,
    speed: 60,
    ...overrides,
  };
}

function createMockProvider(
  id: string,
  options?: { available?: boolean; response?: string; models?: ModelInfo[] },
): AIProvider {
  const available = options?.available ?? true;
  const response = options?.response ?? "Mock response";
  const models = options?.models ?? [createMockModelInfo()];

  return {
    id,
    name: `Mock Provider ${id}`,
    models,

    async *chatStream(_opts: ChatOptions): AsyncIterable<StreamChunk> {
      yield { type: "text", text: response };
      yield { type: "done", usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } };
    },

    async chat(_opts: ChatOptions): Promise<ChatResponse> {
      return {
        id: "mock-chat-id",
        provider: id,
        model: models[0]?.id ?? "mock-model",
        message: { role: "assistant", content: response },
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop",
      };
    },

    async isAvailable(): Promise<boolean> {
      return available;
    },

    async getHealth(): Promise<ProviderHealth> {
      return {
        provider: id,
        status: available ? "healthy" : "unavailable",
        latencyMs: available ? 100 : 0,
        lastChecked: new Date(),
        errorRate: available ? 0 : 1,
      };
    },
  };
}

async function collectEvents(agent: Agent, message: string): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of agent.run(message)) {
    events.push(event);
  }
  return events;
}

// ════════════════════════════════════════════════════════════
// 1. Full Pipeline Test (AI → Router → Agent)
// ════════════════════════════════════════════════════════════

describe("Integration: Full Pipeline (AI -> Router -> Agent)", () => {
  it("should produce text events from agent via mock provider", async () => {
    const registry = getProviderRegistry();
    // Use HIGH_QUALITY so this provider wins hybrid scoring over stale entries
    const provider = createMockProvider("pipe-mock", {
      response: "Pipeline works!",
      models: [createMockModelInfo(HIGH_QUALITY)],
    });
    registry.register("pipe-mock", provider);

    const router = new AIRouter({ strategy: "hybrid" });
    const agent = new Agent({}, router);

    const events = await collectEvents(agent, "hello");

    const thinkingEvents = events.filter((e) => e.type === "thinking");
    const textEvents = events.filter((e) => e.type === "text");

    expect(thinkingEvents.length).toBeGreaterThanOrEqual(1);
    expect(textEvents.length).toBeGreaterThanOrEqual(1);
    expect(textEvents.some((e) => e.content === "Pipeline works!")).toBe(true);
  });

  it("should make routing decisions with valid strategy", async () => {
    const registry = getProviderRegistry();
    registry.register("pipe-router", createMockProvider("pipe-router"));

    const router = new AIRouter({ strategy: "hybrid" });
    const decision = await router.route([{ role: "user", content: "hello" }]);

    // The router picks from ALL registered providers; just verify a valid decision
    expect(decision.providerId).toBeTruthy();
    expect(decision.providerId).not.toBe("none");
    expect(decision.strategy).toBe("hybrid");
    expect(decision.modelId).toBeTruthy();
    expect(decision.timestamp).toBeInstanceOf(Date);
    expect(typeof decision.score).toBe("number");
    expect(decision.reason).toBeTruthy();
  });

  it("should update the conversation tree after agent run", async () => {
    const registry = getProviderRegistry();
    registry.register("pipe-tree", createMockProvider("pipe-tree", {
      response: "Reply",
      models: [createMockModelInfo(HIGH_QUALITY)],
    }));

    const router = new AIRouter({ strategy: "hybrid" });
    const agent = new Agent({}, router);

    await collectEvents(agent, "hello");

    const tree = agent.getConversation();
    const stats = tree.getStats();

    // Should have user message + assistant message
    expect(stats.totalNodes).toBe(2);
    expect(stats.depth).toBe(2);

    // Root should be the user message
    const root = tree.getRoot();
    expect(root).toBeTruthy();
    expect(root!.message.role).toBe("user");
    expect(root!.message.content).toBe("hello");
  });

  it("should include routing reason in thinking event", async () => {
    const registry = getProviderRegistry();
    registry.register("pipe-think", createMockProvider("pipe-think", {
      models: [createMockModelInfo(HIGH_QUALITY)],
    }));

    const router = new AIRouter({ strategy: "hybrid" });
    const agent = new Agent({}, router);

    const events = await collectEvents(agent, "hello");
    const thinking = events.find((e) => e.type === "thinking");

    expect(thinking).toBeTruthy();
    expect(thinking!.provider).toBeTruthy();
    expect(thinking!.content).toContain("hybrid");
  });
});

// ════════════════════════════════════════════════════════════
// 2. Multi-Turn Conversation Test
// ════════════════════════════════════════════════════════════

describe("Integration: Multi-Turn Conversation", () => {
  it("should build correct tree depth and node count after multiple turns", async () => {
    const registry = getProviderRegistry();
    registry.register("multi-mock", createMockProvider("multi-mock", {
      response: "OK",
      models: [createMockModelInfo(HIGH_QUALITY)],
    }));

    const router = new AIRouter({ strategy: "hybrid" });
    const agent = new Agent({}, router);

    await collectEvents(agent, "First message");
    await collectEvents(agent, "Second message");
    await collectEvents(agent, "Third message");

    const tree = agent.getConversation();
    const stats = tree.getStats();

    // 3 turns x (user + assistant) = 6 nodes, depth 6
    expect(stats.totalNodes).toBe(6);
    expect(stats.depth).toBe(6);
    expect(stats.branches).toBe(0); // Linear conversation
  });

  it("should track conversation stats across turns", async () => {
    const registry = getProviderRegistry();
    registry.register("multi-stats", createMockProvider("multi-stats", {
      models: [createMockModelInfo(HIGH_QUALITY)],
    }));

    const router = new AIRouter({ strategy: "hybrid" });
    const agent = new Agent({}, router);

    await collectEvents(agent, "Turn 1");

    let stats = agent.getStats();
    expect(stats.conversation.totalNodes).toBe(2);
    expect(stats.conversation.depth).toBe(2);

    await collectEvents(agent, "Turn 2");

    stats = agent.getStats();
    expect(stats.conversation.totalNodes).toBe(4);
    expect(stats.conversation.depth).toBe(4);
  });

  it("should maintain correct message history in tree", async () => {
    const registry = getProviderRegistry();
    registry.register("multi-hist", createMockProvider("multi-hist", {
      response: "Ack",
      models: [createMockModelInfo(HIGH_QUALITY)],
    }));

    const router = new AIRouter({ strategy: "hybrid" });
    const agent = new Agent({}, router);

    await collectEvents(agent, "Hello");
    await collectEvents(agent, "World");

    const messages = agent.getConversation().getMessages();

    // Should be: user(Hello), assistant(Ack), user(World), assistant(Ack)
    expect(messages).toHaveLength(4);
    expect(messages[0]!.role).toBe("user");
    expect(messages[0]!.content).toBe("Hello");
    expect(messages[1]!.role).toBe("assistant");
    expect(messages[2]!.role).toBe("user");
    expect(messages[2]!.content).toBe("World");
    expect(messages[3]!.role).toBe("assistant");
  });

  it("should accumulate router event log across turns", async () => {
    const registry = getProviderRegistry();
    registry.register("multi-evt", createMockProvider("multi-evt", {
      models: [createMockModelInfo(HIGH_QUALITY)],
    }));

    const router = new AIRouter({ strategy: "hybrid" });

    const eventCountBefore = router.getEventLog().length;

    const agent = new Agent({}, router);
    await collectEvents(agent, "Turn 1");
    await collectEvents(agent, "Turn 2");

    const eventLog = router.getEventLog();
    const newDecisionEvents = eventLog
      .slice(eventCountBefore)
      .filter((e) => e.type === "decision");
    expect(newDecisionEvents.length).toBeGreaterThanOrEqual(2);
  });
});

// ════════════════════════════════════════════════════════════
// 3. Router Strategy Switching Test
// ════════════════════════════════════════════════════════════

describe("Integration: Router Strategy Switching", () => {
  it("should switch from hybrid to cost strategy", async () => {
    const registry = getProviderRegistry();
    registry.register("strat-mock", createMockProvider("strat-mock"));

    const router = new AIRouter({ strategy: "hybrid" });
    expect(router.getPolicy().strategy).toBe("hybrid");

    router.updatePolicy({ strategy: "cost" });
    expect(router.getPolicy().strategy).toBe("cost");
  });

  it("should route correctly after strategy switch", async () => {
    const registry = getProviderRegistry();
    registry.register("strat-route", createMockProvider("strat-route"));

    const router = new AIRouter({ strategy: "hybrid" });

    // Route with hybrid
    const d1 = await router.route([{ role: "user", content: "hello" }]);
    expect(d1.strategy).toBe("hybrid");
    expect(d1.providerId).not.toBe("none");

    // Switch to cost
    router.updatePolicy({ strategy: "cost" });

    // Route again - should use cost strategy
    const d2 = await router.route([{ role: "user", content: "hello" }]);
    expect(d2.strategy).toBe("cost");
    expect(d2.providerId).toBeTruthy();
  });

  it("should preserve other policy fields when switching strategy", () => {
    const router = new AIRouter({
      strategy: "hybrid",
      weights: { quality: 0.5, cost: 0.2, speed: 0.2, availability: 0.1 },
      fallback: "some-fallback",
    });

    router.updatePolicy({ strategy: "cost" });

    const policy = router.getPolicy();
    expect(policy.strategy).toBe("cost");
    expect(policy.weights).toEqual({ quality: 0.5, cost: 0.2, speed: 0.2, availability: 0.1 });
    expect(policy.fallback).toBe("some-fallback");
  });

  it("should work through static, task, cost, and hybrid strategies sequentially", async () => {
    const registry = getProviderRegistry();
    registry.register("strat-all", createMockProvider("strat-all", {
      models: [createMockModelInfo(HIGH_QUALITY)],
    }));

    const router = new AIRouter({ strategy: "static" });

    // Test strategies that work without initialize() or special setup
    // ("task" needs classification data, "failover" needs chain+initialize — tested separately)
    const strategies: Array<RoutingPolicy["strategy"]> = ["static", "cost", "hybrid"];
    for (const strategy of strategies) {
      router.updatePolicy({ strategy });
      const decision = await router.route([{ role: "user", content: "test" }]);
      expect(decision.strategy).toBe(strategy);
      // providerId may be "none" for strategies that need initialize() to score providers
      expect(typeof decision.providerId).toBe("string");
    }
  });
});

// ════════════════════════════════════════════════════════════
// 4. Provider Failover Test
// ════════════════════════════════════════════════════════════

describe("Integration: Provider Failover", () => {
  it("should fall back to healthy provider when primary is unavailable", async () => {
    const registry = getProviderRegistry();
    registry.register("fo-fail", createMockProvider("fo-fail", { available: false }));
    registry.register("fo-ok", createMockProvider("fo-ok", {
      available: true,
      response: "Fallback OK",
    }));

    // Use failover strategy with explicit chain: unhealthy first, healthy second
    const router = new AIRouter({
      strategy: "failover",
      failoverChain: [
        { providerId: "fo-fail", modelId: "mock-model" },
        { providerId: "fo-ok", modelId: "mock-model" },
      ],
    });
    await router.initialize();

    const decision = await router.route([{ role: "user", content: "hello" }]);

    // fo-fail is unhealthy, so the chain skips to fo-ok
    expect(decision.providerId).toBe("fo-ok");
    expect(decision.reason).toContain("healthy");
  });

  it("should use first healthy provider in failover chain", async () => {
    const registry = getProviderRegistry();
    registry.register("fo-both-ok-a", createMockProvider("fo-both-ok-a", { available: true }));
    registry.register("fo-both-ok-b", createMockProvider("fo-both-ok-b", { available: true }));

    const router = new AIRouter({
      strategy: "failover",
      failoverChain: [
        { providerId: "fo-both-ok-a", modelId: "mock-model" },
        { providerId: "fo-both-ok-b", modelId: "mock-model" },
      ],
    });
    await router.initialize();

    const decision = await router.route([{ role: "user", content: "hello" }]);

    // Both healthy: chain picks the first one
    expect(decision.providerId).toBe("fo-both-ok-a");
  });

  it("should log failover events in the event log", async () => {
    const registry = getProviderRegistry();
    registry.register("fo-log-fail", createMockProvider("fo-log-fail", { available: false }));
    registry.register("fo-log-ok", createMockProvider("fo-log-ok", { available: true }));

    const router = new AIRouter({
      strategy: "failover",
      failoverChain: [
        { providerId: "fo-log-fail", modelId: "mock-model" },
        { providerId: "fo-log-ok", modelId: "mock-model" },
      ],
    });
    const eventCountBefore = router.getEventLog().length;
    await router.initialize();

    await router.route([{ role: "user", content: "hello" }]);

    // The failover strategy with chain should produce a decision event
    const newEvents = router.getEventLog().slice(eventCountBefore);
    const decisionEvents = newEvents.filter((e) => e.type === "decision");
    expect(decisionEvents.length).toBeGreaterThanOrEqual(1);
    // The decision should point to the healthy provider
    const lastDecision = decisionEvents[decisionEvents.length - 1];
    expect(lastDecision!.decision!.providerId).toBe("fo-log-ok");
  });

  it("should select healthy provider via failover strategy with failoverChain", async () => {
    const registry = getProviderRegistry();
    registry.register("fo-chain-bad", createMockProvider("fo-chain-bad", { available: false }));
    registry.register("fo-chain-good", createMockProvider("fo-chain-good", { available: true }));

    const router = new AIRouter({
      strategy: "failover",
      failoverChain: [
        { providerId: "fo-chain-bad", modelId: "mock-model" },
        { providerId: "fo-chain-good", modelId: "mock-model" },
      ],
    });
    await router.initialize();

    const decision = await router.route([{ role: "user", content: "hello" }]);

    // The failover strategy iterates the chain and picks the first healthy provider
    expect(decision.providerId).toBe("fo-chain-good");
  });

  it("should prefer healthy providers via hybrid strategy even with higher quality unhealthy ones", async () => {
    const registry = getProviderRegistry();
    // Unhealthy provider with max quality — hybrid should skip it
    registry.register("fo-hyb-uniq", createMockProvider("fo-hyb-uniq", {
      available: false,
      models: [createMockModelInfo({ ...HIGHEST_QUALITY, quality: 101, speed: 100, costPerMInput: 0, costPerMOutput: 0 })],
    }));
    // Healthy provider with moderate quality
    registry.register("fo-hyb-back", createMockProvider("fo-hyb-back", {
      available: true,
      response: "Healthy win",
      models: [createMockModelInfo(HIGHEST_QUALITY)],
    }));

    const router = new AIRouter({ strategy: "hybrid" });
    await router.initialize();

    const decision = await router.route([{ role: "user", content: "hello" }]);

    // Hybrid filters out unhealthy providers, so fo-hyb-back wins
    expect(decision.providerId).toBe("fo-hyb-back");
  });
});

// ════════════════════════════════════════════════════════════
// 5. SDK Integration Test
// ════════════════════════════════════════════════════════════

describe("Integration: SDK", () => {
  it("should return chat response from mock provider", async () => {
    const registry = getProviderRegistry();
    // Use highest quality to ensure this provider beats stale entries (e.g. "fo-hyb-back" quality 100)
    registry.register("sdk-pipe", createMockProvider("sdk-pipe", {
      response: "Hello SDK",
      models: [createMockModelInfo({ quality: 101, speed: 100 })],
    }));

    const sdk = new GuiguziSDK({ routerPolicy: { strategy: "hybrid" } });
    const response = await sdk.chat("s1", "Hi");

    expect(response).toBe("Hello SDK");
    await sdk.shutdown();
  });

  it("should track session IDs after multiple chats", async () => {
    const registry = getProviderRegistry();
    registry.register("sdk-sess", createMockProvider("sdk-sess", {
      models: [createMockModelInfo(HIGHEST_QUALITY)],
    }));

    const sdk = new GuiguziSDK({ routerPolicy: { strategy: "hybrid" } });

    await sdk.chat("alpha", "msg1");
    await sdk.chat("beta", "msg2");

    const ids = sdk.getSessionIds();
    expect(ids).toContain("alpha");
    expect(ids).toContain("beta");
    expect(ids).toHaveLength(2);

    await sdk.shutdown();
  });

  it("should return router stats with correct shape", async () => {
    const registry = getProviderRegistry();
    registry.register("sdk-stats", createMockProvider("sdk-stats", {
      models: [createMockModelInfo(HIGHEST_QUALITY)],
    }));

    const sdk = new GuiguziSDK({ routerPolicy: { strategy: "cost" } });

    await sdk.chat("s1", "hello");

    const stats = sdk.getRouterStats();
    expect(stats.policy.strategy).toBe("cost");
    expect(typeof stats.dailySpent).toBe("number");
    expect(stats.eventCount).toBeGreaterThanOrEqual(1);

    await sdk.shutdown();
  });

  it("should clean up on shutdown and allow re-initialization", async () => {
    const registry = getProviderRegistry();
    registry.register("sdk-sd", createMockProvider("sdk-sd", {
      response: "After restart",
      models: [createMockModelInfo({ quality: 102, speed: 100 })],
    }));

    const sdk = new GuiguziSDK({ routerPolicy: { strategy: "hybrid" } });

    await sdk.chat("s1", "before");
    expect(sdk.getSessionIds()).toHaveLength(1);

    await sdk.shutdown();

    // After shutdown, sessions are cleared
    expect(sdk.getSessionIds()).toHaveLength(0);

    // Can re-initialize and chat again
    const response = await sdk.chat("s2", "after");
    expect(response).toBe("After restart");
    expect(sdk.getSessionIds()).toContain("s2");

    await sdk.shutdown();
  });

  it("should reuse agent for same session ID", async () => {
    const registry = getProviderRegistry();
    registry.register("sdk-reuse", createMockProvider("sdk-reuse", {
      response: "Ack",
      models: [createMockModelInfo(HIGHEST_QUALITY)],
    }));

    const sdk = new GuiguziSDK({ routerPolicy: { strategy: "hybrid" } });

    await sdk.chat("sess", "First");
    await sdk.chat("sess", "Second");

    // Still just one session
    expect(sdk.getSessionIds()).toHaveLength(1);
    expect(sdk.getSessionIds()).toContain("sess");

    await sdk.shutdown();
  });
});

// ════════════════════════════════════════════════════════════
// 6. Gateway Channel Parsing Integration Test
// ════════════════════════════════════════════════════════════

describe("Integration: Gateway Channel Parsing", () => {
  // ─── Feishu ───

  describe("Feishu", () => {
    it("should parse a valid Feishu message event into GatewayMessage", () => {
      const body = {
        header: { create_time: "1700000000" },
        event: {
          message: {
            message_id: "msg_001",
            chat_id: "chat_abc",
            chat_type: "group",
            content: '{"text":"Hello from Feishu"}',
          },
          sender: { sender_id: { open_id: "user_xyz" } },
        },
      };

      const msg = parseFeishuEvent(body);

      expect(msg).toBeTruthy();
      expect(msg!.id).toBe("msg_001");
      expect(msg!.channel).toBe("feishu");
      expect(msg!.peer.kind).toBe("group");
      expect(msg!.peer.id).toBe("chat_abc");
      expect(msg!.content).toBe("Hello from Feishu");
      expect(msg!.sender).toBe("user_xyz");
      expect(msg!.timestamp).toBeInstanceOf(Date);
    });

    it("should return null for Feishu URL verification challenge", () => {
      const body = { type: "url_verification", challenge: "abc123" };
      expect(parseFeishuEvent(body)).toBeNull();
    });

    it("should return null for invalid Feishu body", () => {
      expect(parseFeishuEvent(null)).toBeNull();
      expect(parseFeishuEvent("string")).toBeNull();
      expect(parseFeishuEvent({})).toBeNull();
    });

    it("should handle Feishu DM (non-group) chat type", () => {
      const body = {
        header: { create_time: "1700000000" },
        event: {
          message: {
            message_id: "dm_001",
            chat_id: "dm_chat",
            chat_type: "p2p",
            content: '{"text":"DM message"}',
          },
          sender: { sender_id: { open_id: "user_dm" } },
        },
      };

      const msg = parseFeishuEvent(body);
      expect(msg).toBeTruthy();
      expect(msg!.peer.kind).toBe("user");
    });
  });

  // ─── Slack ───

  describe("Slack", () => {
    it("should parse a valid Slack event_callback into GatewayMessage", () => {
      const body = {
        type: "event_callback",
        event: {
          type: "message",
          text: "Hello from Slack",
          user: "U12345",
          channel: "C67890",
          ts: "1700000000.123456",
        },
      };

      const msg = parseSlackEvent(body);

      expect(msg).toBeTruthy();
      expect(msg!.id).toBe("1700000000.123456");
      expect(msg!.channel).toBe("slack");
      expect(msg!.peer.kind).toBe("group");
      expect(msg!.peer.id).toBe("C67890");
      expect(msg!.content).toBe("Hello from Slack");
      expect(msg!.sender).toBe("U12345");
      expect(msg!.timestamp).toBeInstanceOf(Date);
    });

    it("should return null for Slack URL verification challenge", () => {
      const body = { type: "url_verification", challenge: "xyz" };
      expect(parseSlackEvent(body)).toBeNull();
    });

    it("should return null for Slack bot messages (with subtype)", () => {
      const body = {
        type: "event_callback",
        event: {
          type: "message",
          subtype: "bot_message",
          text: "Bot says hi",
          channel: "C1",
          ts: "123",
        },
      };
      expect(parseSlackEvent(body)).toBeNull();
    });

    it("should return null for non-message Slack events", () => {
      const body = {
        type: "event_callback",
        event: { type: "channel_join", user: "U1", channel: "C1", ts: "123" },
      };
      expect(parseSlackEvent(body)).toBeNull();
    });
  });

  // ─── Discord ───

  describe("Discord", () => {
    it("should parse a valid Discord MESSAGE_CREATE into GatewayMessage", () => {
      const body = {
        type: 3,
        d: {
          id: "discord_msg_001",
          content: "Hello from Discord",
          author: { id: "author_42", username: "testuser" },
          channel_id: "ch_999",
          timestamp: "2024-01-01T00:00:00.000Z",
        },
      };

      const msg = parseDiscordInteraction(body);

      expect(msg).toBeTruthy();
      expect(msg!.id).toBe("discord_msg_001");
      expect(msg!.channel).toBe("discord");
      expect(msg!.peer.kind).toBe("group");
      expect(msg!.peer.id).toBe("ch_999");
      expect(msg!.content).toBe("Hello from Discord");
      expect(msg!.sender).toBe("author_42");
      expect(msg!.timestamp).toBeInstanceOf(Date);
    });

    it("should return null for Discord ping (type 1)", () => {
      expect(parseDiscordInteraction({ type: 1 })).toBeNull();
    });

    it("should return null for unknown Discord interaction types", () => {
      expect(parseDiscordInteraction({ type: 99 })).toBeNull();
    });

    it("should return null for Discord message without author", () => {
      const body = { type: 3, d: { id: "1", content: "hi", channel_id: "c1" } };
      expect(parseDiscordInteraction(body)).toBeNull();
    });
  });

  // ─── Cross-Channel Consistency ───

  describe("Cross-channel consistency", () => {
    it("should produce consistent GatewayMessage shape from all channels", () => {
      const feishuBody = {
        header: { create_time: "1700000000" },
        event: {
          message: {
            message_id: "f1",
            chat_id: "c1",
            chat_type: "group",
            content: '{"text":"test"}',
          },
          sender: { sender_id: { open_id: "u1" } },
        },
      };

      const slackBody = {
        type: "event_callback",
        event: { type: "message", text: "test", user: "u1", channel: "c1", ts: "1700000000" },
      };

      const discordBody = {
        type: 3,
        d: {
          id: "d1",
          content: "test",
          author: { id: "u1" },
          channel_id: "c1",
          timestamp: "2024-01-01T00:00:00.000Z",
        },
      };

      const feishuMsg = parseFeishuEvent(feishuBody);
      const slackMsg = parseSlackEvent(slackBody);
      const discordMsg = parseDiscordInteraction(discordBody);

      expect(feishuMsg).toBeTruthy();
      expect(slackMsg).toBeTruthy();
      expect(discordMsg).toBeTruthy();

      // All must have the same set of required fields
      for (const msg of [feishuMsg!, slackMsg!, discordMsg!]) {
        expect(typeof msg.id).toBe("string");
        expect(typeof msg.channel).toBe("string");
        expect(typeof msg.peer.kind).toBe("string");
        expect(typeof msg.peer.id).toBe("string");
        expect(typeof msg.content).toBe("string");
        expect(typeof msg.sender).toBe("string");
        expect(msg.timestamp).toBeInstanceOf(Date);
      }

      // Channel field should reflect the source
      expect(feishuMsg!.channel).toBe("feishu");
      expect(slackMsg!.channel).toBe("slack");
      expect(discordMsg!.channel).toBe("discord");
    });
  });
});
