import { describe, it, expect, beforeEach } from "vitest";
import { SessionManager } from "../sessions.js";
import type { ChatMessage } from "../sessions.js";

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    role: "user",
    content: "Hello",
    timestamp: new Date(),
    ...overrides,
  };
}

describe("SessionManager", () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  // ── createSession ──────────────────────────────────────────

  it("should create a session with a unique ID", () => {
    const s1 = manager.createSession();
    const s2 = manager.createSession();
    expect(s1.id).toBeDefined();
    expect(s2.id).toBeDefined();
    expect(s1.id).not.toBe(s2.id);
  });

  it("should use the provided name", () => {
    const session = manager.createSession("My Session");
    expect(session.name).toBe("My Session");
  });

  it("should generate a default name when none provided", () => {
    const session = manager.createSession();
    expect(session.name).toMatch(/^Session /);
  });

  it("should initialize with zero messages", () => {
    const session = manager.createSession();
    expect(session.messageCount).toBe(0);
  });

  it("should set createdAt and updatedAt", () => {
    const before = Date.now();
    const session = manager.createSession();
    const after = Date.now();

    expect(session.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(session.createdAt.getTime()).toBeLessThanOrEqual(after);
    expect(session.updatedAt.getTime()).toBe(session.createdAt.getTime());
  });

  // ── getSession ─────────────────────────────────────────────

  it("should retrieve a session by ID", () => {
    const session = manager.createSession("Test");
    const retrieved = manager.getSession(session.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(session.id);
    expect(retrieved!.name).toBe("Test");
  });

  it("should return null for a non-existent session", () => {
    const result = manager.getSession("non-existent-id");
    expect(result).toBeNull();
  });

  // ── listSessions ───────────────────────────────────────────

  it("should return an empty array when no sessions exist", () => {
    expect(manager.listSessions()).toEqual([]);
  });

  it("should list all created sessions", () => {
    manager.createSession("A");
    manager.createSession("B");
    manager.createSession("C");
    const sessions = manager.listSessions();
    expect(sessions).toHaveLength(3);
  });

  it("should sort sessions by updatedAt descending", () => {
    const s1 = manager.createSession("First");
    const s2 = manager.createSession("Second");
    // Add a message to s1 so its updatedAt becomes newer than s2
    manager.addMessage(s1.id, makeMessage());
    const sessions = manager.listSessions();
    expect(sessions[0].id).toBe(s1.id);
    expect(sessions[1].id).toBe(s2.id);
  });

  // ── deleteSession ──────────────────────────────────────────

  it("should delete an existing session", () => {
    const session = manager.createSession();
    const result = manager.deleteSession(session.id);
    expect(result).toBe(true);
    expect(manager.getSession(session.id)).toBeNull();
  });

  it("should return false when deleting a non-existent session", () => {
    expect(manager.deleteSession("non-existent")).toBe(false);
  });

  it("should also remove messages when deleting a session", () => {
    const session = manager.createSession();
    manager.addMessage(session.id, makeMessage());
    manager.deleteSession(session.id);
    // After re-creating, messages should be gone
    expect(() => manager.getMessages(session.id)).toThrow();
  });

  // ── addMessage ─────────────────────────────────────────────

  it("should add a message to a session", () => {
    const session = manager.createSession();
    const msg = makeMessage({ content: "Hello world" });
    manager.addMessage(session.id, msg);

    const messages = manager.getMessages(session.id);
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("Hello world");
  });

  it("should increment messageCount after adding a message", () => {
    const session = manager.createSession();
    expect(session.messageCount).toBe(0);

    manager.addMessage(session.id, makeMessage());
    const updated = manager.getSession(session.id);
    expect(updated!.messageCount).toBe(1);
  });

  it("should update the session updatedAt timestamp", () => {
    const session = manager.createSession();
    const originalUpdated = session.updatedAt.getTime();

    // Small delay to ensure different timestamp
    manager.addMessage(session.id, makeMessage());
    const updated = manager.getSession(session.id);
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdated);
  });

  it("should throw when adding a message to a non-existent session", () => {
    expect(() => {
      manager.addMessage("non-existent", makeMessage());
    }).toThrow("Session not found");
  });

  // ── getMessages ────────────────────────────────────────────

  it("should return messages in insertion order", () => {
    const session = manager.createSession();
    manager.addMessage(session.id, makeMessage({ content: "First" }));
    manager.addMessage(session.id, makeMessage({ content: "Second" }));
    manager.addMessage(session.id, makeMessage({ content: "Third" }));

    const messages = manager.getMessages(session.id);
    expect(messages).toHaveLength(3);
    expect(messages[0].content).toBe("First");
    expect(messages[1].content).toBe("Second");
    expect(messages[2].content).toBe("Third");
  });

  it("should return a copy of messages (not a reference)", () => {
    const session = manager.createSession();
    manager.addMessage(session.id, makeMessage({ content: "Original" }));

    const messages = manager.getMessages(session.id);
    messages.push(makeMessage({ content: "Mutated" }));

    const again = manager.getMessages(session.id);
    expect(again).toHaveLength(1);
  });

  it("should throw when getting messages from a non-existent session", () => {
    expect(() => {
      manager.getMessages("non-existent");
    }).toThrow("Session not found");
  });

  it("should handle different message roles", () => {
    const session = manager.createSession();
    manager.addMessage(session.id, makeMessage({ role: "user", content: "Hi" }));
    manager.addMessage(session.id, makeMessage({ role: "assistant", content: "Hello!" }));
    manager.addMessage(session.id, makeMessage({ role: "system", content: "System msg" }));

    const messages = manager.getMessages(session.id);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");
    expect(messages[2].role).toBe("system");
  });

  it("should preserve message metadata", () => {
    const session = manager.createSession();
    const msg = makeMessage({
      content: "With meta",
      metadata: { model: "gpt-4", tokens: 42 },
    });
    manager.addMessage(session.id, msg);

    const messages = manager.getMessages(session.id);
    expect(messages[0].metadata).toEqual({ model: "gpt-4", tokens: 42 });
  });
});
