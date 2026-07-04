import type { GatewayMessage } from "../index.js";

/**
 * Parse a Discord interaction / gateway event body into a GatewayMessage.
 *
 * Discord sends:
 *   1. Ping: { type: 1 } → return null
 *   2. MESSAGE_CREATE (type 3): { type: 3, d: { id, content, author: { id, username }, channel_id } }
 *
 * Returns null for non-message events.
 */
export function parseDiscordInteraction(body: unknown): GatewayMessage | null {
  if (!body || typeof body !== "object") return null;

  const obj = body as Record<string, unknown>;

  // Ping — not a message
  if (obj.type === 1) return null;

  // MESSAGE_CREATE
  if (obj.type === 3) {
    const d = obj.d as Record<string, unknown> | undefined;
    if (!d || typeof d !== "object") return null;

    const author = d.author as Record<string, unknown> | undefined;
    if (!author || typeof author !== "object") return null;

    return {
      id: String(d.id ?? ""),
      channel: "discord",
      peer: { kind: "group", id: String(d.channel_id ?? "") },
      content: String(d.content ?? ""),
      sender: String(author.id ?? ""),
      timestamp: new Date(d.timestamp ? new Date(d.timestamp as string).getTime() : Date.now()),
    };
  }

  return null;
}
