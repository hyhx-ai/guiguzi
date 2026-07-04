import type { GatewayMessage } from "../index.js";

/**
 * Parse a Feishu webhook event body into a GatewayMessage.
 *
 * Feishu sends two kinds of requests:
 *   1. URL verification challenge: { type: "url_verification", challenge: string }
 *   2. Event callback with a message: { header: {...}, event: { message: {...}, sender: {...} } }
 *
 * Returns null for non-message events (including URL verification).
 */
export function parseFeishuEvent(body: unknown): GatewayMessage | null {
  if (!body || typeof body !== "object") return null;

  const obj = body as Record<string, unknown>;

  // URL verification challenge — not a message
  if (obj.type === "url_verification") return null;

  // Must have header and event
  const header = obj.header as Record<string, unknown> | undefined;
  const event = obj.event as Record<string, unknown> | undefined;
  if (!header || !event || typeof header !== "object" || typeof event !== "object") return null;

  // Extract message and sender from event
  const message = event.message as Record<string, unknown> | undefined;
  const sender = event.sender as Record<string, unknown> | undefined;
  if (!message || !sender || typeof message !== "object" || typeof sender !== "object") return null;

  // Parse the JSON content string — Feishu wraps content as JSON: {"text":"..."}
  let content = "";
  if (typeof message.content === "string") {
    try {
      const parsed = JSON.parse(message.content) as Record<string, unknown>;
      content = typeof parsed.text === "string" ? parsed.text : message.content;
    } catch {
      content = message.content;
    }
  }

  const chatType = message.chat_type === "group" ? "group" : "user";

  const senderId = sender.sender_id as Record<string, unknown> | string | undefined;
  const senderIdStr = typeof senderId === "object" && senderId !== null
    ? String(senderId.open_id ?? "")
    : String(senderId ?? "");

  return {
    id: String(message.message_id ?? ""),
    channel: "feishu",
    peer: { kind: chatType, id: String(message.chat_id ?? "") },
    content,
    sender: senderIdStr,
    timestamp: new Date(Number(header.create_time) ? Number(header.create_time) * 1000 : Date.now()),
  };
}
