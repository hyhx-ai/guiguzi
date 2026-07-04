// ─── Guiguzi Console Server Starter ───
// Starts the web console as a standalone HTTP server

import { serve } from "@hono/node-server";
import type { AIRouter } from "@guiguzi/router";
import { createConsoleApp } from "./console.js";

export interface ConsoleServerOptions {
  router: AIRouter;
  host?: string;
  port?: number;
  version?: string;
}

export async function startConsoleServer(options: ConsoleServerOptions) {
  const {
    router,
    host = "0.0.0.0",
    port = 3000,
    version = "0.1.0-alpha",
  } = options;

  const app = createConsoleApp({ router, version });

  const server = serve(
    {
      fetch: app.fetch,
      hostname: host,
      port,
    },
    (info) => {
      console.log(`⟨guiguzi⟩ Console running at http://${host === "0.0.0.0" ? "localhost" : host}:${info.port}`);
    },
  );

  return server;
}
