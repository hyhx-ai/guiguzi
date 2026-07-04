// ─── Router Types ───

import type { ModelInfo, TaskClassification, ProviderHealth } from "@novaclaw/ai";

// ─── Routing Strategies ───

export type RoutingStrategy =
  | "static"      // Fixed provider selection
  | "task"        // Route by task classification
  | "cost"        // Minimize cost
  | "failover"    // Maximize availability
  | "hybrid";     // Combined multi-dimensional scoring

// ─── Routing Policy ───

export interface RoutingPolicy {
  strategy: RoutingStrategy;

  // Hybrid strategy weights (must sum to 1.0)
  weights?: RoutingWeights;

  // Failover chain (ordered by priority)
  failoverChain?: FailoverConfig[];

  // Budget constraints
  budget?: BudgetConfig;

  // Static bindings (for static strategy)
  bindings?: StaticBinding[];

  // Fallback provider ID (e.g., "ollama:llama4")
  fallback?: string;

  // Maximum latency before failover (ms)
  maxLatencyMs?: number;
}

export interface RoutingWeights {
  quality: number;      // 0-1, weight for model quality score
  cost: number;         // 0-1, weight for cost efficiency
  speed: number;        // 0-1, weight for response speed
  availability: number; // 0-1, weight for provider availability
}

export interface FailoverConfig {
  providerId: string;
  modelId: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface BudgetConfig {
  dailyLimitUsd?: number;
  perTaskLimitUsd?: number;
  preferLocal?: boolean;
  maxCostPerMToken?: number;
}

export interface StaticBinding {
  match: {
    channel?: string;
    peer?: { kind: "group" | "user"; id: string };
  };
  providerId: string;
  modelId: string;
}

// ─── Routing Decision ───

export interface RoutingDecision {
  providerId: string;
  modelId: string;
  model: ModelInfo;
  strategy: RoutingStrategy;
  score: number;
  reason: string;
  alternatives: RoutingAlternative[];
  timestamp: Date;
}

export interface RoutingAlternative {
  providerId: string;
  modelId: string;
  model: ModelInfo;
  score: number;
  reason: string;
}

// ─── Route Events (for monitoring/logging) ───

export interface RouteEvent {
  type: "decision" | "failover" | "fallback" | "budget_exceeded";
  timestamp: Date;
  task?: TaskClassification;
  decision?: RoutingDecision;
  from?: { providerId: string; modelId: string };
  to?: { providerId: string; modelId: string };
  reason?: string;
  cost?: number;
  latencyMs?: number;
}

// ─── Health Snapshot ───

export interface HealthSnapshot {
  providers: Map<string, ProviderHealth>;
  lastUpdated: Date;
}
