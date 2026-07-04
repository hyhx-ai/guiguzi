import type { GatewayMessage } from "../index.js";

/**
 * Parse a MS Teams Bot Framework activity into a GatewayMessage.
 *
 * MS Teams sends:
 *   { type: "message", id, channelId, conversation: { id }, from: { id, name }, text, timestamp }
 *
 * Returns null for non-message activities (invocation, conversationUpdate, etc.).
 */
export function parseMSTeamsActivity(body: unknown): GatewayMessage | null {
  if (!body || typeof body !== "object") return null;

  const obj = body as Record<string, unknown>;

  // Only handle message activities
  if (obj.type !== "message") return null;

  // Ignore messages without text content
  if (typeof obj.text !== "string" || obj.text.length === 0) return null;

  const conversation = obj.conversation as Record<string, unknown> | undefined;
  if (!conversation || typeof conversation !== "object") return null;

  const from = obj.from as Record<string, unknown> | undefined;
  if (!from || typeof from !== "object") return null;

  // Determine peer kind: group chats have conversationType "channel" or "group"
  const convType = obj.conversationType as string | undefined;
  const peerKind = convType === "channel" || convType === "group" ? "group" : "user";

  return {
    id: String(obj.id ?? ""),
    channel: "msteams",
    peer: { kind: peerKind, id: String(conversation.id ?? "") },
    content: String(obj.text ?? ""),
    sender: String(from.id ?? ""),
    timestamp: new Date(typeof obj.timestamp === "string" ? new Date(obj.timestamp).getTime() : Date.now()),
  };
}
