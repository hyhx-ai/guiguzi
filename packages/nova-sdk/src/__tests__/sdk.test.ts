import { describe, it, expect, beforeEach } from "vitest";
import { GuiguziSDK } from "../index.js";
import type { GuiguziSDKConfig } from "../index.js";

describe("GuiguziSDK", () => {
  let sdk: GuiguziSDK;

  beforeEach(() => {
    sdk = new GuiguziSDK();
  });

  it("should construct with default config", () => {
    expect(sdk).toBeDefined();
  });

  it("should construct with custom router policy", () => {
    const config: GuiguziSDKConfig = {
      routerPolicy: { strategy: "cost" },
    };
    const customSdk = new GuiguziSDK(config);
    expect(customSdk).toBeDefined();
  });

  it("should construct with all strategies", () => {
    const strategies = ["static", "task", "cost", "failover", "hybrid"] as const;
    for (const strategy of strategies) {
      const s = new GuiguziSDK({ routerPolicy: { strategy } });
      expect(s).toBeDefined();
    }
  });

  describe("getSessionIds", () => {
    it("should return empty array initially", () => {
      expect(sdk.getSessionIds()).toEqual([]);
    });
  });

  describe("getRouterStats", () => {
    it("should return stats with correct shape", () => {
      const stats = sdk.getRouterStats();
      expect(stats).toHaveProperty("policy");
      expect(stats).toHaveProperty("dailySpent");
      expect(stats).toHaveProperty("eventCount");
      expect(typeof stats.dailySpent).toBe("number");
      expect(typeof stats.eventCount).toBe("number");
    });

    it("should start with zero spending", () => {
      const stats = sdk.getRouterStats();
      expect(stats.dailySpent).toBe(0);
    });

    it("should start with zero events", () => {
      const stats = sdk.getRouterStats();
      expect(stats.eventCount).toBe(0);
    });

    it("should reflect the configured policy", () => {
      const customSdk = new GuiguziSDK({ routerPolicy: { strategy: "failover" } });
      const stats = customSdk.getRouterStats();
      expect(stats.policy.strategy).toBe("failover");
    });
  });

  describe("shutdown", () => {
    it("should shutdown cleanly", async () => {
      await sdk.shutdown();
      // Should not throw
    });

    it("should clear sessions on shutdown", async () => {
      await sdk.shutdown();
      expect(sdk.getSessionIds()).toEqual([]);
    });

    it("should allow re-initialization after shutdown", async () => {
      await sdk.shutdown();
      const stats = sdk.getRouterStats();
      expect(stats).toBeDefined();
    });
  });
});
