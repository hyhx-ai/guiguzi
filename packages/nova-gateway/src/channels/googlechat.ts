import type { GatewayMessage } from "../index.js";

/**
 * Parse a Google Chat event into a GatewayMessage.
 *
 * Google Chat sends:
 *   { type: "MESSAGE", eventTime, message: { name, text, sender: { name, displayName }, thread: { name }, space: { name } } }
 *
 * Returns null for non-message events (ADDED_TO_SPACE, REMOVED_FROM_SPACE, etc.).
 */
export function parseGoogleChatEvent(body: unknown): GatewayMessage | null {
  if (!body || typeof body !== "object") return null;

  const obj = body as Record<string, unknown>;

  // Only handle MESSAGE events
  if (obj.type !== "MESSAGE") return null;

  const message = obj.message as Record<string, unknown> | undefined;
  if (!message || typeof message !== "object") return null;

  // Ignore messages without text
  if (typeof message.text !== "string" || message.text.length === 0) return null;

  const sender = message.sender as Record<string, unknown> | undefined;
  if (!sender || typeof sender !== "object") return null;

  const space = message.space as Record<string, unknown> | undefined;
  const thread = message.thread as Record<string, unknown> | undefined;

  // Determine peer kind: DM spaces have type "DM", spaces have type "SPACE"
  const spaceType = space?.type as string | undefined;
  const peerKind = spaceType === "DM" ? "user" : "group";
  const peerId = String(space?.name ?? message.name ?? "");

  return {
    id: String(message.name ?? ""),
    channel: "googlechat",
    peer: { kind: peerKind, id: peerId },
    content: String(message.text ?? ""),
    sender: String(sender.name ?? ""),
    timestamp: new Date(typeof obj.eventTime === "string" ? new Date(obj.eventTime).getTime() : Date.now()),
  };
}
