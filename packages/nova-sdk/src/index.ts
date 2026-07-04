// ─── NovaClaw SDK ───
// Embed NovaClaw agent into your own applications

import { AIRouter } from "@novaclaw/router";
import { Agent } from "@novaclaw/agent-core";
import type { AgentConfig, AgentEvent } from "@novaclaw/agent-core";
import type { RoutingPolicy } from "@novaclaw/router";

export interface NovaClawSDKConfig {
  routerPolicy?: RoutingPolicy;
  agentConfig?: AgentConfig;
}

export class NovaClawSDK {
  private router: AIRouter;
  private agents = new Map<string, Agent>();
  private initialized = false;

  constructor(config: NovaClawSDKConfig = {}) {
    this.router = new AIRouter(config.routerPolicy ?? { strategy: "hybrid" });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.router.initialize();
    this.initialized = true;
  }

  async chat(sessionId: string, message: string): Promise<string> {
    await this.initialize();

    let agent = this.agents.get(sessionId);
    if (!agent) {
      agent = new Agent({}, this.router);
      this.agents.set(sessionId, agent);
    }

    let response = "";
    for await (const event of agent.run(message)) {
      if (event.type === "text") {
        response += event.content;
      }
    }
    return response;
  }

  async *chatStream(sessionId: string, message: string): AsyncIterable<AgentEvent> {
    await this.initialize();

    let agent = this.agents.get(sessionId);
    if (!agent) {
      agent = new Agent({}, this.router);
      this.agents.set(sessionId, agent);
    }

    yield* agent.run(message);
  }

  getSessionIds(): string[] {
    return Array.from(this.agents.keys());
  }

  getRouterStats(): {
    policy: RoutingPolicy;
    dailySpent: number;
    eventCount: number;
  } {
    return {
      policy: this.router.getPolicy(),
      dailySpent: this.router.getDailySpent(),
      eventCount: this.router.getEventLog().length,
    };
  }

  async shutdown(): Promise<void> {
    this.router.shutdown();
    this.agents.clear();
    this.initialized = false;
  }
}
