import type { GatewayMessage } from "../index.js";

/**
 * Parse a Telegram Bot API update into a GatewayMessage.
 *
 * Telegram sends:
 *   { update_id, message: { message_id, chat: { id, type }, text, from: { id, username }, date } }
 *
 * Returns null for non-message updates (edited_message, callback_query, etc.).
 */
export function parseTelegramUpdate(body: unknown): GatewayMessage | null {
  if (!body || typeof body !== "object") return null;

  const obj = body as Record<string, unknown>;
  const message = obj.message as Record<string, unknown> | undefined;
  if (!message || typeof message !== "object") return null;

  // Ignore messages without text (e.g. stickers, photos without caption)
  if (typeof message.text !== "string") return null;

  const chat = message.chat as Record<string, unknown> | undefined;
  if (!chat || typeof chat !== "object") return null;

  const from = message.from as Record<string, unknown> | undefined;
  if (!from || typeof from !== "object") return null;

  const chatType = chat.type === "group" || chat.type === "supergroup" ? "group" : "user";

  return {
    id: String(message.message_id ?? ""),
    channel: "telegram",
    peer: { kind: chatType, id: String(chat.id ?? "") },
    content: String(message.text ?? ""),
    sender: String(from.id ?? ""),
    timestamp: new Date(typeof message.date === "number" ? message.date * 1000 : Date.now()),
  };
}
