import type { GatewayMessage } from "../index.js";

/**
 * Parse a LINE Messaging API webhook body into a GatewayMessage.
 *
 * LINE sends:
 *   { events: [{ type: "message", message: { id, type: "text", text }, source: { type, userId }, timestamp, replyToken }] }
 *
 * Returns null for non-message events (follow, join, postback, etc.).
 */
export function parseLineWebhook(body: unknown): GatewayMessage | null {
  if (!body || typeof body !== "object") return null;

  const obj = body as Record<string, unknown>;
  const events = obj.events as unknown[] | undefined;
  if (!Array.isArray(events) || events.length === 0) return null;

  // Find the first text message event
  for (const raw of events) {
    if (!raw || typeof raw !== "object") continue;
    const event = raw as Record<string, unknown>;

    if (event.type !== "message") continue;

    const message = event.message as Record<string, unknown> | undefined;
    if (!message || typeof message !== "object") continue;
    if (message.type !== "text") continue;

    const source = event.source as Record<string, unknown> | undefined;
    if (!source || typeof source !== "object") continue;

    const peerKind = source.type === "group" || source.type === "room" ? "group" : "user";
    const peerId = String(source.groupId ?? source.roomId ?? source.userId ?? "");

    return {
      id: String(message.id ?? ""),
      channel: "line",
      peer: { kind: peerKind, id: peerId },
      content: String(message.text ?? ""),
      sender: String(source.userId ?? ""),
      timestamp: new Date(typeof event.timestamp === "number" ? event.timestamp : Date.now()),
    };
  }

  return null;
}
