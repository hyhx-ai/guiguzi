// ─── NovaClaw Web Console ───
// Web management console API (frontend served separately)

import type { AIRouter, RoutingPolicy, RouteEvent } from "@novaclaw/router";

export interface WebConsoleConfig {
  router: AIRouter;
  port: number;
}

export interface DashboardStats {
  totalRequests: number;
  dailyCost: number;
  activeAgents: number;
  providerHealth: Record<string, {
    status: string;
    latencyMs: number;
    errorRate: number;
  }>;
  recentEvents: RouteEvent[];
}

export function getDashboardStats(router: AIRouter): DashboardStats {
  const events = router.getEventLog();
  const policy = router.getPolicy();

  return {
    totalRequests: events.filter((e) => e.type === "decision").length,
    dailyCost: router.getDailySpent(),
    activeAgents: 0, // TODO: Track active agents
    providerHealth: {}, // TODO: Pull from health monitor
    recentEvents: events.slice(-50),
  };
}

export { createConsoleApp } from "./console.js";
export type { ConsoleAppConfig } from "./console.js";

export { SessionManager } from "./sessions.js";
export type { Session, ChatMessage } from "./sessions.js";

export { ProviderConfigManager } from "./providers.js";
export type { ProviderConfig, ProviderConfigInput, ProviderTestResult } from "./providers.js";

export function generateRouterVisualization(events: RouteEvent[]): string {
  // Generate Mermaid diagram of routing decisions
  const decisions = events.filter((e) => e.type === "decision" && e.decision);
  const lines = ["graph LR"];

  for (const event of decisions.slice(-10)) {
    if (!event.decision || !event.task) continue;
    const taskLabel = event.task.type;
    const modelLabel = event.decision.modelId;
    const score = event.decision.score.toFixed(1);
    lines.push(`  ${taskLabel}["${taskLabel}"] --> |"${score}"| ${modelLabel.replace(/[:\-]/g, "_")}["${modelLabel}"]`);
  }

  return lines.join("\n");
}
