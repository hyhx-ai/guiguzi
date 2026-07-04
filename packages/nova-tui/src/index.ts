// ─── Guiguzi TUI ───
// Terminal UI components (placeholder for Ink-based TUI)

export interface Theme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  textDim: string;
  error: string;
  success: string;
  warning: string;
}

export const DEFAULT_THEME: Theme = {
  primary: "#00e5c7",
  secondary: "#a78bfa",
  accent: "#f5a623",
  background: "#0a0c10",
  text: "#e0e4ec",
  textDim: "#6b7280",
  error: "#ef4444",
  success: "#22c55e",
  warning: "#f5a623",
};

export function formatRouterDecision(decision: {
  providerId: string;
  modelId: string;
  strategy: string;
  score: number;
  reason: string;
}): string {
  return `[${decision.strategy}] → ${decision.providerId}:${decision.modelId} (score: ${decision.score.toFixed(1)}) ${decision.reason}`;
}

export function formatHealthStatus(status: "healthy" | "degraded" | "unavailable"): string {
  switch (status) {
    case "healthy": return "✓ healthy";
    case "degraded": return "⚠ degraded";
    case "unavailable": return "✗ unavailable";
  }
}

// ─── Ink Components ───

export { ChatView } from "./components/ChatView.js";
export type { ChatViewProps, ChatMessage, ToolCall } from "./components/ChatView.js";

export { StatusBar } from "./components/StatusBar.js";
export type { StatusBarProps } from "./components/StatusBar.js";

export { RouterPanel } from "./components/RouterPanel.js";
export type { RouterPanelProps, ProviderHealth, RoutingDecision } from "./components/RouterPanel.js";
