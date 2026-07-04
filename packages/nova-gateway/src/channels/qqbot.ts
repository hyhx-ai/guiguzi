import type { GatewayMessage } from "../index.js";

/**
 * Parse a QQ Bot event into a GatewayMessage.
 *
 * QQ Bot sends:
 *   { id, group_openid or openid, author: { id, user_openid }, content, timestamp }
 *
 * Group messages have group_openid; DMs have openid.
 * Returns null for non-message events.
 */
export function parseQQBotEvent(body: unknown): GatewayMessage | null {
  if (!body || typeof body !== "object") return null;

  const obj = body as Record<string, unknown>;

  // Must have an event id
  if (typeof obj.id !== "string") return null;

  // Must have content
  if (typeof obj.content !== "string") return null;

  const author = obj.author as Record<string, unknown> | undefined;
  if (!author || typeof author !== "object") return null;

  // Determine peer kind: group messages have group_openid, DMs have openid
  const groupOpenid = obj.group_openid as string | undefined;
  const isGroup = typeof groupOpenid === "string" && groupOpenid.length > 0;
  const peerId = isGroup ? groupOpenid : String(obj.openid ?? "");

  return {
    id: String(obj.id ?? ""),
    channel: "qqbot",
    peer: { kind: isGroup ? "group" : "user", id: peerId },
    content: String(obj.content ?? ""),
    sender: String(author.user_openid ?? author.id ?? ""),
    timestamp: new Date(typeof obj.timestamp === "string" ? new Date(obj.timestamp).getTime() : Date.now()),
  };
}
