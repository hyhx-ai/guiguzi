import type { GatewayMessage } from "../index.js";

/**
 * Parse a Slack event webhook body into a GatewayMessage.
 *
 * Slack sends two kinds of requests:
 *   1. URL verification: { type: "url_verification", challenge: string }
 *   2. Event callback: { type: "event_callback", event: { type, text, user, channel, ts, ... } }
 *
 * Only "message" events from real users are converted. Bot messages, joins, etc. return null.
 */
export function parseSlackEvent(body: unknown): GatewayMessage | null {
  if (!body || typeof body !== "object") return null;

  const obj = body as Record<string, unknown>;

  // URL verification challenge — not a message
  if (obj.type === "url_verification") return null;

  // Must be an event_callback
  if (obj.type !== "event_callback") return null;

  const event = obj.event as Record<string, unknown> | undefined;
  if (!event || typeof event !== "object") return null;

  // Only handle plain "message" events — ignore bot_message, channel_join, etc.
  if (event.type !== "message") return null;
  if (event.subtype !== undefined) return null; // bot_message, channel_join, etc.

  return {
    id: String(event.ts ?? event.event_ts ?? ""),
    channel: "slack",
    peer: { kind: "group", id: String(event.channel ?? "") },
    content: String(event.text ?? ""),
    sender: String(event.user ?? ""),
    timestamp: new Date(event.ts ? Math.round(Number(event.ts) * 1000) : Date.now()),
  };
}
