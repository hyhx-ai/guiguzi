import { describe, it, expect, vi, beforeEach } from "vitest";
import { RateLimiter } from "../rate-limiter.js";
import { MessageQueue } from "../message-queue.js";
import { SessionSync } from "../session-sync.js";
import type { QueuedMessage } from "../message-queue.js";
import type { GatewayMessage } from "../index.js";

// ─── Helpers ───

function makeGatewayMessage(overrides: Partial<GatewayMessage> = {}): GatewayMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    channel: "test",
    peer: { kind: "user", id: "peer-1" },
    content: "hello",
    sender: "sender-1",
    timestamp: new Date(),
    ...overrides,
  };
}

function makeQueuedMessage(overrides: Partial<QueuedMessage> = {}): QueuedMessage {
  return {
    id: `q-${Math.random().toString(36).slice(2, 8)}`,
    channel: "test",
    message: makeGatewayMessage(),
    priority: 5,
    enqueuedAt: new Date(),
    retries: 0,
    ...overrides,
  };
}

// ═══════════════════════════════════════════
// RateLimiter
// ═══════════════════════════════════════════

describe("RateLimiter", () => {
  it("should allow consume when tokens are available", () => {
    const limiter = new RateLimiter({ maxTokens: 10, refillRate: 1, refillIntervalMs: 1000 });
    expect(limiter.consume("user-a")).toBe(true);
  });

  it("should deny consume when tokens are exhausted", () => {
    const limiter = new RateLimiter({ maxTokens: 2, refillRate: 1, refillIntervalMs: 60_000 });
    expect(limiter.consume("user-b")).toBe(true);
    expect(limiter.consume("user-b")).toBe(true);
    expect(limiter.consume("user-b")).toBe(false);
  });

  it("should consume multiple tokens at once", () => {
    const limiter = new RateLimiter({ maxTokens: 5, refillRate: 1, refillIntervalMs: 60_000 });
    expect(limiter.consume("user-c", 3)).toBe(true);
    expect(limiter.consume("user-c", 3)).toBe(false);
    expect(limiter.consume("user-c", 2)).toBe(true);
  });

  it("should refill tokens over time", () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter({ maxTokens: 5, refillRate: 2, refillIntervalMs: 1000 });

    // Exhaust all tokens
    expect(limiter.consume("user-d", 5)).toBe(true);
    expect(limiter.consume("user-d")).toBe(false);

    // Advance time by 1 second → should refill 2 tokens
    vi.advanceTimersByTime(1000);
    expect(limiter.consume("user-d")).toBe(true);
    expect(limiter.consume("user-d")).toBe(true);
    expect(limiter.consume("user-d")).toBe(false);

    // Advance 3 more seconds → should refill 6, but capped at 5
    vi.advanceTimersByTime(3000);
    expect(limiter.getRemaining("user-d")).toBe(5);

    vi.useRealTimers();
  });

  it("should isolate tokens per key", () => {
    const limiter = new RateLimiter({ maxTokens: 1, refillRate: 0, refillIntervalMs: 60_000 });
    expect(limiter.consume("alice")).toBe(true);
    expect(limiter.consume("alice")).toBe(false);
    // Bob has his own bucket
    expect(limiter.consume("bob")).toBe(true);
  });

  it("should reset a key back to full tokens", () => {
    const limiter = new RateLimiter({ maxTokens: 3, refillRate: 0, refillIntervalMs: 60_000 });
    limiter.consume("user-e", 3);
    expect(limiter.consume("user-e")).toBe(false);

    limiter.reset("user-e");
    expect(limiter.getRemaining("user-e")).toBe(3);
    expect(limiter.consume("user-e")).toBe(true);
  });

  it("should report remaining tokens correctly", () => {
    const limiter = new RateLimiter({ maxTokens: 10, refillRate: 0, refillIntervalMs: 60_000 });
    expect(limiter.getRemaining("user-f")).toBe(10);
    limiter.consume("user-f", 4);
    expect(limiter.getRemaining("user-f")).toBe(6);
  });

  it("should handle new keys starting at max tokens", () => {
    const limiter = new RateLimiter({ maxTokens: 7, refillRate: 1, refillIntervalMs: 500 });
    expect(limiter.getRemaining("new-key")).toBe(7);
  });
});

// ═══════════════════════════════════════════
// MessageQueue
// ═══════════════════════════════════════════

describe("MessageQueue", () => {
  let queue: MessageQueue;

  beforeEach(() => {
    queue = new MessageQueue();
  });

  it("should start empty", () => {
    expect(queue.size()).toBe(0);
    expect(queue.isEmpty()).toBe(true);
    expect(queue.dequeue()).toBeUndefined();
    expect(queue.peek()).toBeUndefined();
  });

  it("should enqueue and dequeue in FIFO order for same priority", () => {
    const msg1 = makeQueuedMessage({ id: "first", priority: 5 });
    const msg2 = makeQueuedMessage({ id: "second", priority: 5 });
    const msg3 = makeQueuedMessage({ id: "third", priority: 5 });

    queue.enqueue(msg1);
    queue.enqueue(msg2);
    queue.enqueue(msg3);

    expect(queue.size()).toBe(3);
    expect(queue.dequeue()?.id).toBe("first");
    expect(queue.dequeue()?.id).toBe("second");
    expect(queue.dequeue()?.id).toBe("third");
    expect(queue.isEmpty()).toBe(true);
  });

  it("should dequeue lower priority numbers first", () => {
    const low = makeQueuedMessage({ id: "low", priority: 1 });
    const mid = makeQueuedMessage({ id: "mid", priority: 5 });
    const high = makeQueuedMessage({ id: "high", priority: 10 });

    queue.enqueue(high);
    queue.enqueue(low);
    queue.enqueue(mid);

    expect(queue.dequeue()?.id).toBe("low");
    expect(queue.dequeue()?.id).toBe("mid");
    expect(queue.dequeue()?.id).toBe("high");
  });

  it("should peek without removing", () => {
    const msg = makeQueuedMessage({ id: "peek-test" });
    queue.enqueue(msg);

    expect(queue.peek()?.id).toBe("peek-test");
    expect(queue.size()).toBe(1);
  });

  it("should report size correctly after mixed operations", () => {
    queue.enqueue(makeQueuedMessage());
    queue.enqueue(makeQueuedMessage());
    queue.enqueue(makeQueuedMessage());
    expect(queue.size()).toBe(3);

    queue.dequeue();
    expect(queue.size()).toBe(2);
  });

  it("should drain all messages in priority order", () => {
    queue.enqueue(makeQueuedMessage({ id: "a", priority: 3 }));
    queue.enqueue(makeQueuedMessage({ id: "b", priority: 1 }));
    queue.enqueue(makeQueuedMessage({ id: "c", priority: 2 }));

    const drained = queue.drain();
    expect(drained).toHaveLength(3);
    expect(drained[0]!.id).toBe("b");
    expect(drained[1]!.id).toBe("c");
    expect(drained[2]!.id).toBe("a");
    expect(queue.isEmpty()).toBe(true);
  });

  it("should clear all messages", () => {
    queue.enqueue(makeQueuedMessage());
    queue.enqueue(makeQueuedMessage());
    expect(queue.size()).toBe(2);

    queue.clear();
    expect(queue.size()).toBe(0);
    expect(queue.isEmpty()).toBe(true);
  });

  it("should handle drain on empty queue", () => {
    const drained = queue.drain();
    expect(drained).toEqual([]);
  });
});

// ═══════════════════════════════════════════
// SessionSync
// ═══════════════════════════════════════════

describe("SessionSync", () => {
  let sync: SessionSync;

  beforeEach(() => {
    sync = new SessionSync();
  });

  it("should link channels to a session and resolve them", () => {
    sync.linkSession("session-1", [
      { channel: "feishu", peerId: "user-100", linkedAt: new Date() },
      { channel: "slack", peerId: "U12345", linkedAt: new Date() },
    ]);

    expect(sync.resolveSession("feishu", "user-100")).toBe("session-1");
    expect(sync.resolveSession("slack", "U12345")).toBe("session-1");
  });

  it("should return null for unknown channel+peer combos", () => {
    expect(sync.resolveSession("feishu", "nobody")).toBeNull();
  });

  it("should return all links for a session", () => {
    const links = [
      { channel: "feishu", peerId: "user-1", linkedAt: new Date() },
      { channel: "discord", peerId: "disc-1", linkedAt: new Date() },
      { channel: "web", peerId: "web-1", linkedAt: new Date() },
    ];
    sync.linkSession("session-2", links);

    const result = sync.getLinks("session-2");
    expect(result).toHaveLength(3);
    expect(result.map((l) => l.channel).sort()).toEqual(["discord", "feishu", "web"]);
  });

  it("should return empty array for unknown session links", () => {
    expect(sync.getLinks("nonexistent")).toEqual([]);
  });

  it("should unlink a session and remove all its reverse mappings", () => {
    sync.linkSession("session-3", [
      { channel: "feishu", peerId: "user-3", linkedAt: new Date() },
      { channel: "slack", peerId: "U99", linkedAt: new Date() },
    ]);

    expect(sync.resolveSession("feishu", "user-3")).toBe("session-3");

    sync.unlinkSession("session-3");
    expect(sync.resolveSession("feishu", "user-3")).toBeNull();
    expect(sync.resolveSession("slack", "U99")).toBeNull();
    expect(sync.getLinks("session-3")).toEqual([]);
  });

  it("should list all active sessions", () => {
    sync.linkSession("s1", [{ channel: "feishu", peerId: "a", linkedAt: new Date() }]);
    sync.linkSession("s2", [{ channel: "slack", peerId: "b", linkedAt: new Date() }]);
    sync.linkSession("s3", [{ channel: "discord", peerId: "c", linkedAt: new Date() }]);

    const sessions = sync.getActiveSessions();
    expect(sessions).toHaveLength(3);
    expect(sessions.sort()).toEqual(["s1", "s2", "s3"]);
  });

  it("should replace links when linking to an existing session ID", () => {
    sync.linkSession("session-x", [
      { channel: "feishu", peerId: "old-user", linkedAt: new Date() },
    ]);
    expect(sync.resolveSession("feishu", "old-user")).toBe("session-x");

    // Re-link with different channels
    sync.linkSession("session-x", [
      { channel: "slack", peerId: "new-user", linkedAt: new Date() },
    ]);

    expect(sync.resolveSession("slack", "new-user")).toBe("session-x");
    // Old mapping should be gone
    expect(sync.resolveSession("feishu", "old-user")).toBeNull();
  });

  it("should support multiple channels per session", () => {
    sync.linkSession("multi", [
      { channel: "feishu", peerId: "f1", linkedAt: new Date() },
      { channel: "slack", peerId: "s1", linkedAt: new Date() },
      { channel: "discord", peerId: "d1", linkedAt: new Date() },
      { channel: "web", peerId: "w1", linkedAt: new Date() },
    ]);

    expect(sync.resolveSession("feishu", "f1")).toBe("multi");
    expect(sync.resolveSession("slack", "s1")).toBe("multi");
    expect(sync.resolveSession("discord", "d1")).toBe("multi");
    expect(sync.resolveSession("web", "w1")).toBe("multi");
    expect(sync.getLinks("multi")).toHaveLength(4);
  });

  it("should handle unlinking a non-existent session gracefully", () => {
    // Should not throw
    sync.unlinkSession("does-not-exist");
    expect(sync.getActiveSessions()).toEqual([]);
  });
});
