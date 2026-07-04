// ─── Guiguzi Console Server ───
// Serves the management dashboard HTML and API endpoints

import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { AIRouter, RouteEvent } from "@guiguzi/router";
import { getDashboardStats, generateRouterVisualization } from "./index.js";
import { SessionManager } from "./sessions.js";
import { ProviderConfigManager } from "./providers.js";
import type { ChatMessage } from "./sessions.js";
import type { ProviderConfigInput } from "./providers.js";

// ─── Config ──────────────────────────────────────────────────

export interface ConsoleAppConfig {
  router: AIRouter;
  version?: string;
}

// ─── Lazy HTML loader ────────────────────────────────────────

let _cachedHtml: string | undefined;

function getConsoleHtml(): string {
  if (_cachedHtml) return _cachedHtml;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const htmlPath = join(__dirname, "console.html");
  _cachedHtml = readFileSync(htmlPath, "utf-8");
  return _cachedHtml;
}

// ─── Console App Factory ─────────────────────────────────────

export function createConsoleApp(config: ConsoleAppConfig): Hono {
  const { router, version = "0.1.0-alpha" } = config;
  const app = new Hono();

  const sessionManager = new SessionManager();
  const providerManager = new ProviderConfigManager();

  // ── Serve the dashboard HTML ───────────────────────────────
  app.get("/", (c) => {
    const html = getConsoleHtml()
      .replace("v0.1.0", `v${version}`)
      .replace(
        "Guiguzi v0.1.0-alpha",
        `Guiguzi v${version}`,
      );
    return c.html(html);
  });

  // ── API: Dashboard Stats ───────────────────────────────────
  app.get("/api/stats", (c) => {
    const stats = getDashboardStats(router);
    return c.json({
      totalRequests: stats.totalRequests,
      dailyCost: stats.dailyCost,
      activeAgents: stats.activeAgents,
      providerHealth: stats.providerHealth,
    });
  });

  // ── API: Recent Events ─────────────────────────────────────
  app.get("/api/events", (c) => {
    const events = router.getEventLog().slice(-50);
    return c.json(events);
  });

  // ── API: Router Status ─────────────────────────────────────
  app.get("/api/router", (c) => {
    const policy = router.getPolicy();
    const events = router.getEventLog();
    const visualization = generateRouterVisualization(events);

    return c.json({
      policy,
      dailySpent: router.getDailySpent(),
      eventCount: events.length,
      visualization,
    });
  });

  // ── API: Sessions ──────────────────────────────────────────

  app.get("/api/sessions", (c) => {
    return c.json(sessionManager.listSessions());
  });

  app.post("/api/sessions", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const session = sessionManager.createSession(body.name);
    return c.json(session, 201);
  });

  app.get("/api/sessions/:id", (c) => {
    const id = c.req.param("id");
    const session = sessionManager.getSession(id);
    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }
    const messages = sessionManager.getMessages(id);
    return c.json({ session, messages });
  });

  app.delete("/api/sessions/:id", (c) => {
    const id = c.req.param("id");
    const deleted = sessionManager.deleteSession(id);
    if (!deleted) {
      return c.json({ error: "Session not found" }, 404);
    }
    return c.json({ success: true });
  });

  app.post("/api/sessions/:id/messages", async (c) => {
    const id = c.req.param("id");
    try {
      const body = await c.req.json();
      const message: ChatMessage = {
        id: body.id ?? randomUUID(),
        role: body.role ?? "user",
        content: body.content ?? "",
        timestamp: new Date(body.timestamp ?? Date.now()),
        metadata: body.metadata,
      };
      sessionManager.addMessage(id, message);
      return c.json(message, 201);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Session not found")) {
        return c.json({ error: msg }, 404);
      }
      return c.json({ error: msg }, 400);
    }
  });

  // ── API: Providers ─────────────────────────────────────────

  app.get("/api/providers", (c) => {
    return c.json(providerManager.getProviders());
  });

  app.post("/api/providers", async (c) => {
    try {
      const body = await c.req.json() as ProviderConfigInput;
      const provider = providerManager.addProvider(body);
      return c.json(provider, 201);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg }, 400);
    }
  });

  app.put("/api/providers/:id", async (c) => {
    const id = c.req.param("id");
    try {
      const body = await c.req.json() as Partial<ProviderConfigInput>;
      const provider = providerManager.updateProvider(id, body);
      if (!provider) {
        return c.json({ error: "Provider not found" }, 404);
      }
      return c.json(provider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg }, 400);
    }
  });

  app.delete("/api/providers/:id", (c) => {
    const id = c.req.param("id");
    const deleted = providerManager.removeProvider(id);
    if (!deleted) {
      return c.json({ error: "Provider not found" }, 404);
    }
    return c.json({ success: true });
  });

  app.post("/api/providers/:id/test", async (c) => {
    const id = c.req.param("id");
    const result = await providerManager.testProvider(id);
    return c.json(result);
  });

  return app;
}
