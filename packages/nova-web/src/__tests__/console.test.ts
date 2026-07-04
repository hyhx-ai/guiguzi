import { describe, it, expect } from "vitest";
import { createConsoleApp } from "../console.js";
import { AIRouter } from "@novaclaw/router";
import type { RouteEvent } from "@novaclaw/router";

function makeTestRouter() {
  return new AIRouter({ strategy: "hybrid" });
}

describe("createConsoleApp", () => {
  it("should return a Hono app", () => {
    const router = makeTestRouter();
    const app = createConsoleApp({ router });

    expect(app).toBeDefined();
    expect(typeof app.fetch).toBe("function");
    expect(typeof app.route).toBe("function");
    expect(typeof app.get).toBe("function");
  });

  it("should accept a version in config", () => {
    const router = makeTestRouter();
    const app = createConsoleApp({ router, version: "1.2.3" });
    expect(app).toBeDefined();
  });

  it("should have GET / route (dashboard HTML)", async () => {
    const router = makeTestRouter();
    const app = createConsoleApp({ router });

    // We can't test the full HTML response because the HTML file
    // won't be in dist/ during tests, but we can verify the route exists
    // by checking that the app doesn't return 404 for the path.
    // The route is registered, so it will try to handle it.
    const routes = app.routes;
    const rootRoute = routes.find(
      (r) => r.path === "/" && r.method === "GET"
    );
    expect(rootRoute).toBeDefined();
  });

  it("should have GET /api/stats route", () => {
    const router = makeTestRouter();
    const app = createConsoleApp({ router });

    const routes = app.routes;
    const statsRoute = routes.find(
      (r) => r.path === "/api/stats" && r.method === "GET"
    );
    expect(statsRoute).toBeDefined();
  });

  it("should have GET /api/events route", () => {
    const router = makeTestRouter();
    const app = createConsoleApp({ router });

    const routes = app.routes;
    const eventsRoute = routes.find(
      (r) => r.path === "/api/events" && r.method === "GET"
    );
    expect(eventsRoute).toBeDefined();
  });

  it("should have GET /api/router route", () => {
    const router = makeTestRouter();
    const app = createConsoleApp({ router });

    const routes = app.routes;
    const routerRoute = routes.find(
      (r) => r.path === "/api/router" && r.method === "GET"
    );
    expect(routerRoute).toBeDefined();
  });

  it("should have all expected routes including sessions and providers", () => {
    const router = makeTestRouter();
    const app = createConsoleApp({ router });

    // GET routes: /, /api/stats, /api/events, /api/router,
    //   /api/sessions, /api/sessions/:id, /api/providers
    const getRoutes = app.routes.filter((r) => r.method === "GET");
    expect(getRoutes.length).toBe(7);

    // Check new session routes exist
    const sessionRoutes = app.routes.filter((r) => r.path.startsWith("/api/sessions"));
    expect(sessionRoutes.length).toBeGreaterThanOrEqual(4);

    // Check new provider routes exist
    const providerRoutes = app.routes.filter((r) => r.path.startsWith("/api/providers"));
    expect(providerRoutes.length).toBeGreaterThanOrEqual(4);
  });

  describe("GET /api/stats", () => {
    it("should return JSON with stats", async () => {
      const router = makeTestRouter();
      const app = createConsoleApp({ router });

      const res = await app.request("/api/stats");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty("totalRequests");
      expect(body).toHaveProperty("dailyCost");
      expect(body).toHaveProperty("activeAgents");
      expect(body).toHaveProperty("providerHealth");
      expect(typeof body.totalRequests).toBe("number");
      expect(typeof body.dailyCost).toBe("number");
    });

    it("should return zero stats for a fresh router", async () => {
      const router = makeTestRouter();
      const app = createConsoleApp({ router });

      const res = await app.request("/api/stats");
      const body = await res.json();
      expect(body.totalRequests).toBe(0);
      expect(body.dailyCost).toBe(0);
      expect(body.activeAgents).toBe(0);
    });
  });

  describe("GET /api/events", () => {
    it("should return an empty array for a fresh router", async () => {
      const router = makeTestRouter();
      const app = createConsoleApp({ router });

      const res = await app.request("/api/events");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(0);
    });
  });

  describe("GET /api/router", () => {
    it("should return router status with policy", async () => {
      const router = makeTestRouter();
      const app = createConsoleApp({ router });

      const res = await app.request("/api/router");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty("policy");
      expect(body).toHaveProperty("dailySpent");
      expect(body).toHaveProperty("eventCount");
      expect(body).toHaveProperty("visualization");
      expect(body.policy.strategy).toBe("hybrid");
      expect(typeof body.visualization).toBe("string");
      expect(body.visualization).toContain("graph LR");
    });
  });
});
