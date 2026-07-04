// ─── Guiguzi TUI ───
// OpenClaw-style vertical stack terminal UI

export { getTheme, detectTheme, darkTheme, lightTheme, DEFAULT_THEME } from "./theme.js";
export type { ThemePalette, Theme } from "./theme.js";

export { Header } from "./components/Header.js";
export type { HeaderProps } from "./components/Header.js";

export { ChatLog, ChatLog as ChatView } from "./components/ChatView.js";
export type { ChatMessage, ToolCallDisplay, ChatLogProps } from "./components/ChatView.js";

export { StatusLine } from "./components/StatusLine.js";
export type { StatusLineProps } from "./components/StatusLine.js";

export { Footer } from "./components/Footer.js";
export type { FooterProps } from "./components/Footer.js";

export { Editor } from "./components/Editor.js";
export type { EditorProps } from "./components/Editor.js";

export { StatusBar } from "./components/StatusBar.js";
export type { StatusBarProps } from "./components/StatusBar.js";

export { RouterPanel } from "./components/RouterPanel.js";
export type { RouterPanelProps, ProviderHealth, RoutingDecision } from "./components/RouterPanel.js";

export { slashCommands, parseSlashCommand, executeCommand } from "./slash-commands.js";
export type { SlashCommand, CommandContext } from "./slash-commands.js";

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
