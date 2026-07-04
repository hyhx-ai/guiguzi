// ─── Ink Render Entry ───
// Mounts the AgentApp component using Ink's React renderer

import React from "react";
import { render } from "ink";
import { AgentApp } from "./AgentApp.js";
import type { Agent } from "@novaclaw/agent-core";
import type { AIRouter } from "@novaclaw/router";

/**
 * Render the interactive agent TUI.
 * Replaces the readline-based REPL with a full Ink application.
 */
export function renderAgentApp(
  agent: Agent,
  router: AIRouter,
  workspace: string
): void {
  const app = render(
    React.createElement(AgentApp, { agent, router, workspace }),
    {
      exitOnCtrlC: true,
    }
  );

  // When the Ink app unmounts (e.g. user typed /quit), clean up the router
  app.waitUntilExit().then(() => {
    router.shutdown();
  });
}
