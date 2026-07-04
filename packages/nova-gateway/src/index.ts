// ─── NovaClaw Gateway ───
// Multi-channel gateway: Feishu, Slack, Discord, Web

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { AIRouter } from "@novaclaw/router";
import { Agent } from "@novaclaw/agent-core";
import type { AgentEvent } from "@novaclaw/agent-core";
import {
  parseFeishuEvent,
  parseSlackEvent,
  parseDiscordInteraction,
  parseWebChat,
} from "./channels/index.js";
import { RateLimiter } from "./rate-limiter.js";
import type { RateLimiterConfig } from "./rate-limiter.js";
import { MessageQueue } from "./message-queue.js";
import type { QueuedMessage } from "./message-queue.js";
import { SessionSync } from "./session-sync.js";
import type { ChannelLink } from "./session-sync.js";

export interface GatewayConfig {
  port: number;
  host?: string;
  channels: ChannelConfig[];
  routerPolicy: import("@novaclaw/router").RoutingPolicy;
  rateLimit?: RateLimiterConfig;
}

export interface ChannelConfig {
  type: "feishu" | "slack" | "discord" | "web";
  name: string;
  config: Record<string, unknown>;
  bindings: ChannelBinding[];
}

export interface ChannelBinding {
  peer?: { kind: "group" | "user"; id: string };
  channel?: string;
  agentId: string;
}

export interface GatewayMessage {
  id: string;
  channel: string;
  peer: { kind: "group" | "user"; id: string };
  content: string;
  sender: string;
  timestamp: Date;
}

export class Gateway {
  private config: GatewayConfig;
  private app: Hono;
  private router: AIRouter;
  private agents = new Map<string, Agent>();
  private rateLimiter: RateLimiter;
  private messageQueue: MessageQueue;
  private sessionSync: SessionSync;

  constructor(config: GatewayConfig) {
    this.config = config;
    this.app = new Hono();
    this.router = new AIRouter(config.routerPolicy);
    this.rateLimiter = new RateLimiter(config.rateLimit ?? {
      maxTokens: 60,
      refillRate: 1,
      refillIntervalMs: 1000,
    });
    this.messageQueue = new MessageQueue();
    this.sessionSync = new SessionSync();
    this.setupRoutes();
  }

  async start(): Promise<void> {
    await this.router.initialize();
    console.log(`⟨nova⟩ Gateway starting on port ${this.config.port}...`);

    serve({
      fetch: this.app.fetch,
      port: this.config.port,
      hostname: this.config.host ?? "0.0.0.0",
    });

    console.log(`✓ Gateway listening at http://${this.config.host ?? "0.0.0.0"}:${this.config.port}`);
  }

  async stop(): Promise<void> {
    this.router.shutdown();
    console.log("⟨nova⟩ Gateway stopped");
  }

  private setupRoutes(): void {
    // ─── Health Check ───
    this.app.get("/health", (c) => {
      return c.json({
        status: "ok",
        version: "0.1.0-alpha",
        channels: this.config.channels.length,
        agents: this.agents.size,
        queuedMessages: this.messageQueue.size(),
        activeSessions: this.sessionSync.getActiveSessions().length,
      });
    });

    // ─── Router Status ───
    this.app.get("/api/router/status", (c) => {
      return c.json({
        policy: this.router.getPolicy(),
        dailySpent: this.router.getDailySpent(),
        events: this.router.getEventLog().slice(-20),
      });
    });

    // ─── Web Chat Endpoint ───
    this.app.post("/api/chat", async (c) => {
      const body = await c.req.json<{ message: string; agentId?: string }>();
      const agentId = body.agentId ?? "default";

      let agent = this.agents.get(agentId);
      if (!agent) {
        agent = new Agent({ workspace: process.cwd() }, this.router);
        this.agents.set(agentId, agent);
      }

      const events: AgentEvent[] = [];
      for await (const event of agent.run(body.message)) {
        events.push(event);
      }

      return c.json({ events });
    });

    // ─── Feishu Webhook ───
    this.app.post("/webhook/feishu", async (c) => {
      const body = await c.req.json();

      // URL verification challenge
      if (body?.type === "url_verification") {
        return c.json({ challenge: body.challenge });
      }

      // Rate limiting
      const clientIp = c.req.header("x-forwarded-for") ?? "unknown";
      if (!this.rateLimiter.consume(`feishu:${clientIp}`)) {
        return c.json({ code: 429, message: "Rate limit exceeded" }, 429);
      }

      const msg = parseFeishuEvent(body);
      if (msg) {
        console.log(`⟨nova⟩ [feishu] ${msg.sender}: ${msg.content}`);
        this.enqueueMessage(msg);
      }

      return c.json({ code: 0 });
    });

    // ─── Slack Event ───
    this.app.post("/webhook/slack", async (c) => {
      const body = await c.req.json();

      // URL verification challenge
      if (body?.type === "url_verification") {
        return c.json({ challenge: body.challenge });
      }

      // Rate limiting
      const clientIp = c.req.header("x-forwarded-for") ?? "unknown";
      if (!this.rateLimiter.consume(`slack:${clientIp}`)) {
        return c.json({ error: "Rate limit exceeded" }, 429);
      }

      const msg = parseSlackEvent(body);
      if (msg) {
        console.log(`⟨nova⟩ [slack] ${msg.sender}: ${msg.content}`);
        this.enqueueMessage(msg);
      }

      return c.json({ ok: true });
    });

    // ─── Discord Interaction ───
    this.app.post("/webhook/discord", async (c) => {
      const body = await c.req.json();

      // Ping
      if (body?.type === 1) {
        return c.json({ type: 1 });
      }

      // Rate limiting
      const clientIp = c.req.header("x-forwarded-for") ?? "unknown";
      if (!this.rateLimiter.consume(`discord:${clientIp}`)) {
        return c.json({ error: "Rate limit exceeded" }, 429);
      }

      const msg = parseDiscordInteraction(body);
      if (msg) {
        console.log(`⟨nova⟩ [discord] ${msg.sender}: ${msg.content}`);
        this.enqueueMessage(msg);
      }

      return c.json({ type: 4 });
    });
  }

  /**
   * Route an incoming GatewayMessage to the correct agent based on channel bindings.
   */
  private async handleMessage(msg: GatewayMessage): Promise<void> {
    const channelConfig = this.config.channels.find((ch) => ch.type === msg.channel);
    if (!channelConfig) {
      console.warn(`⟨nova⟩ No channel config for ${msg.channel}, dropping message`);
      return;
    }

    // Find a matching binding for this message
    const binding = channelConfig.bindings.find((b) => {
      if (!b.peer) return true; // catch-all
      return b.peer.kind === msg.peer.kind && b.peer.id === msg.peer.id;
    }) ?? channelConfig.bindings[0];

    if (!binding) {
      console.warn(`⟨nova⟩ No binding for ${msg.channel} message from ${msg.sender}`);
      return;
    }

    const agentId = binding.agentId;
    let agent = this.agents.get(agentId);
    if (!agent) {
      agent = new Agent({ workspace: process.cwd() }, this.router);
      this.agents.set(agentId, agent);
    }

    try {
      for await (const _event of agent.run(msg.content)) {
        // Process events (logging for now; response dispatch will come later)
      }
    } catch (err) {
      console.error(`⟨nova⟩ Agent ${agentId} error:`, err);
    }
  }

  /**
   * Buffer a message into the priority queue for processing.
   */
  private enqueueMessage(msg: GatewayMessage): void {
    const queued: QueuedMessage = {
      id: msg.id,
      channel: msg.channel,
      message: msg,
      priority: 5, // default priority
      enqueuedAt: new Date(),
      retries: 0,
    };
    this.messageQueue.enqueue(queued);

    // Process immediately for now (queue enables future batching/backpressure)
    this.handleMessage(msg).catch((err) => {
      console.error(`⟨nova⟩ Failed to process message ${msg.id}:`, err);
    });
  }

  /** Access the rate limiter instance. */
  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  /** Access the message queue instance. */
  getMessageQueue(): MessageQueue {
    return this.messageQueue;
  }

  /** Access the session sync instance. */
  getSessionSync(): SessionSync {
    return this.sessionSync;
  }
}

// Re-export channel parsers for external consumers
export { parseFeishuEvent, parseSlackEvent, parseDiscordInteraction, parseWebChat } from "./channels/index.js";

// Re-export enhancement modules
export { RateLimiter } from "./rate-limiter.js";
export type { RateLimiterConfig } from "./rate-limiter.js";
export { MessageQueue } from "./message-queue.js";
export type { QueuedMessage } from "./message-queue.js";
export { SessionSync } from "./session-sync.js";
export type { ChannelLink } from "./session-sync.js";
