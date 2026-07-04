import type { GatewayMessage } from "../index.js";

/**
 * Parse an IRC bridge JSON message into a GatewayMessage.
 *
 * IRC bridge format:
 *   { prefix, command: "PRIVMSG", params: [channel, text], nick, user, host }
 *
 * Returns null for non-PRIVMSG commands (PING, JOIN, PART, etc.).
 */
export function parseIrcMessage(body: unknown): GatewayMessage | null {
  if (!body || typeof body !== "object") return null;

  const obj = body as Record<string, unknown>;

  // Only handle PRIVMSG (actual chat messages)
  if (obj.command !== "PRIVMSG") return null;

  const params = obj.params as unknown[] | undefined;
  if (!Array.isArray(params) || params.length < 2) return null;

  const target = String(params[0] ?? "");
  const text = String(params[1] ?? "");

  // Ignore CTCP messages (e.g. ACTION, VERSION)
  if (text.startsWith("\u0001")) return null;

  // IRC channels start with #, & or +; everything else is a user (PM)
  const isGroup = target.startsWith("#") || target.startsWith("&") || target.startsWith("+");

  return {
    id: `irc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    channel: "irc",
    peer: { kind: isGroup ? "group" : "user", id: target },
    content: text,
    sender: String(obj.nick ?? ""),
    timestamp: new Date(),
  };
}
