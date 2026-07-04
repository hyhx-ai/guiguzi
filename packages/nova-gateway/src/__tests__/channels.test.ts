import { describe, it, expect } from "vitest";
import { parseFeishuEvent } from "../channels/feishu.js";
import { parseSlackEvent } from "../channels/slack.js";
import { parseDiscordInteraction } from "../channels/discord.js";
import { parseWebChat } from "../channels/web.js";

// ─── Feishu ──────────────────────────────────────────────────────────────────

describe("parseFeishuEvent", () => {
  it("should parse a valid message event", () => {
    const body = {
      header: {
        event_id: "evt-001",
        event_type: "im.message.receive_v1",
        create_time: "1704067200",
      },
      event: {
        message: {
          message_id: "msg-abc",
          chat_id: "oc-123",
          chat_type: "group",
          content: '{"text":"hello nova"}',
        },
        sender: {
          sender_id: { open_id: "ou-user-1" },
          sender_type: "user",
        },
      },
    };

    const msg = parseFeishuEvent(body);
    expect(msg).not.toBeNull();
    expect(msg!.id).toBe("msg-abc");
    expect(msg!.channel).toBe("feishu");
    expect(msg!.content).toBe("hello nova");
    expect(msg!.sender).toBe("ou-user-1");
    expect(msg!.peer.kind).toBe("group");
    expect(msg!.peer.id).toBe("oc-123");
  });

  it("should return null for url_verification", () => {
    const body = { type: "url_verification", challenge: "abc123" };
    expect(parseFeishuEvent(body)).toBeNull();
  });

  it("should return null for missing header", () => {
    const body = { event: { message: {}, sender: {} } };
    expect(parseFeishuEvent(body)).toBeNull();
  });

  it("should return null for missing event", () => {
    const body = { header: { event_id: "x" } };
    expect(parseFeishuEvent(body)).toBeNull();
  });

  it("should return null for null/undefined", () => {
    expect(parseFeishuEvent(null)).toBeNull();
    expect(parseFeishuEvent(undefined)).toBeNull();
  });

  it("should handle non-JSON content gracefully", () => {
    const body = {
      header: { event_id: "e1", event_type: "msg", create_time: "1704067200" },
      event: {
        message: {
          message_id: "m1",
          chat_id: "c1",
          chat_type: "p2p",
          content: "plain text",
        },
        sender: { sender_id: "u1", sender_type: "user" },
      },
    };
    const msg = parseFeishuEvent(body);
    expect(msg).not.toBeNull();
    expect(msg!.content).toBe("plain text");
    expect(msg!.peer.kind).toBe("user");
  });

  it("should handle missing sender_id.open_id fallback", () => {
    const body = {
      header: { event_id: "e1", event_type: "msg", create_time: "1704067200" },
      event: {
        message: { message_id: "m1", chat_id: "c1", chat_type: "group", content: '{"text":"hi"}' },
        sender: { sender_id: "raw-sender-id", sender_type: "user" },
      },
    };
    const msg = parseFeishuEvent(body);
    expect(msg).not.toBeNull();
    // sender_id is a string, not an object, so .open_id is undefined → falls back to sender_id itself
    expect(msg!.sender).toBe("raw-sender-id");
  });
});

// ─── Slack ───────────────────────────────────────────────────────────────────

describe("parseSlackEvent", () => {
  it("should parse a valid message event", () => {
    const body = {
      type: "event_callback",
      event: {
        type: "message",
        text: "hello from slack",
        user: "U12345",
        channel: "C67890",
        ts: "1704067200.000100",
      },
    };

    const msg = parseSlackEvent(body);
    expect(msg).not.toBeNull();
    expect(msg!.id).toBe("1704067200.000100");
    expect(msg!.channel).toBe("slack");
    expect(msg!.content).toBe("hello from slack");
    expect(msg!.sender).toBe("U12345");
    expect(msg!.peer.id).toBe("C67890");
  });

  it("should return null for url_verification", () => {
    const body = { type: "url_verification", challenge: "slack-challenge" };
    expect(parseSlackEvent(body)).toBeNull();
  });

  it("should return null for bot_message subtype", () => {
    const body = {
      type: "event_callback",
      event: {
        type: "message",
        subtype: "bot_message",
        text: "I am a bot",
        user: "U99",
        channel: "C1",
        ts: "1704067200.000200",
      },
    };
    expect(parseSlackEvent(body)).toBeNull();
  });

  it("should return null for channel_join subtype", () => {
    const body = {
      type: "event_callback",
      event: {
        type: "message",
        subtype: "channel_join",
        user: "U99",
        channel: "C1",
        ts: "1704067200.000300",
      },
    };
    expect(parseSlackEvent(body)).toBeNull();
  });

  it("should return null for non-event_callback type", () => {
    const body = { type: "something_else", event: { type: "message", text: "hi", user: "U1", channel: "C1", ts: "1" } };
    expect(parseSlackEvent(body)).toBeNull();
  });

  it("should return null for null/undefined", () => {
    expect(parseSlackEvent(null)).toBeNull();
    expect(parseSlackEvent(undefined)).toBeNull();
  });
});

// ─── Discord ─────────────────────────────────────────────────────────────────

describe("parseDiscordInteraction", () => {
  it("should parse a MESSAGE_CREATE event", () => {
    const body = {
      type: 3,
      d: {
        id: "msg-discord-1",
        content: "hello discord",
        author: { id: "user-42", username: "novauser" },
        channel_id: "ch-100",
      },
    };

    const msg = parseDiscordInteraction(body);
    expect(msg).not.toBeNull();
    expect(msg!.id).toBe("msg-discord-1");
    expect(msg!.channel).toBe("discord");
    expect(msg!.content).toBe("hello discord");
    expect(msg!.sender).toBe("user-42");
    expect(msg!.peer.id).toBe("ch-100");
  });

  it("should return null for ping (type 1)", () => {
    expect(parseDiscordInteraction({ type: 1 })).toBeNull();
  });

  it("should return null for unknown type", () => {
    expect(parseDiscordInteraction({ type: 99 })).toBeNull();
  });

  it("should return null for missing d field", () => {
    expect(parseDiscordInteraction({ type: 3 })).toBeNull();
  });

  it("should return null for null/undefined", () => {
    expect(parseDiscordInteraction(null)).toBeNull();
    expect(parseDiscordInteraction(undefined)).toBeNull();
  });
});

// ─── Web Chat ────────────────────────────────────────────────────────────────

describe("parseWebChat", () => {
  it("should create a GatewayMessage from web chat input", () => {
    const msg = parseWebChat({ message: "hello web", sessionId: "sess-1" });
    expect(msg.channel).toBe("web");
    expect(msg.content).toBe("hello web");
    expect(msg.sender).toBe("sess-1");
    expect(msg.peer.id).toBe("sess-1");
    expect(msg.peer.kind).toBe("user");
    expect(msg.id).toMatch(/^web-/);
    expect(msg.timestamp).toBeInstanceOf(Date);
  });

  it("should default sessionId to anonymous", () => {
    const msg = parseWebChat({ message: "test" });
    expect(msg.sender).toBe("anonymous");
    expect(msg.peer.id).toBe("anonymous");
  });
});
