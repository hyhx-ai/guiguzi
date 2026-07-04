import type { GatewayMessage } from "../index.js";

/**
 * Parse a web chat request into a GatewayMessage.
 *
 * Web chat is the simplest channel — just a message string and optional session ID.
 */
export function parseWebChat(body: { message: string; sessionId?: string }): GatewayMessage {
  return {
    id: `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    channel: "web",
    peer: { kind: "user", id: body.sessionId ?? "anonymous" },
    content: body.message,
    sender: body.sessionId ?? "anonymous",
    timestamp: new Date(),
  };
}
