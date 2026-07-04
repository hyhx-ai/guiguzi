import type { GatewayMessage } from "../index.js";

/**
 * Parse a Matrix sync event into a GatewayMessage.
 *
 * Matrix sends:
 *   { event_id, type: "m.room.message", room_id, sender, content: { body, msgtype }, origin_server_ts }
 *
 * Returns null for non-message events (state changes, receipts, etc.).
 */
export function parseMatrixEvent(body: unknown): GatewayMessage | null {
  if (!body || typeof body !== "object") return null;

  const obj = body as Record<string, unknown>;

  // Only handle room messages
  if (obj.type !== "m.room.message") return null;

  const content = obj.content as Record<string, unknown> | undefined;
  if (!content || typeof content !== "object") return null;

  // Only handle text messages
  if (content.msgtype !== "m.text") return null;

  return {
    id: String(obj.event_id ?? ""),
    channel: "matrix",
    peer: { kind: "group", id: String(obj.room_id ?? "") },
    content: String(content.body ?? ""),
    sender: String(obj.sender ?? ""),
    timestamp: new Date(typeof obj.origin_server_ts === "number" ? obj.origin_server_ts : Date.now()),
  };
}
