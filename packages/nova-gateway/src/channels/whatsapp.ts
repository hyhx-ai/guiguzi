import type { GatewayMessage } from "../index.js";

/**
 * Parse a WhatsApp Business API webhook into a GatewayMessage.
 *
 * WhatsApp sends:
 *   { object: "whatsapp_business_account", entry: [{ changes: [{ value: { messages: [{ id, from, type, text: { body }, timestamp }] } }] }] }
 *
 * Returns null for non-message events (statuses, errors, etc.).
 */
export function parseWhatsAppMessage(body: unknown): GatewayMessage | null {
  if (!body || typeof body !== "object") return null;

  const obj = body as Record<string, unknown>;
  if (obj.object !== "whatsapp_business_account") return null;

  const entry = obj.entry as unknown[] | undefined;
  if (!Array.isArray(entry) || entry.length === 0) return null;

  for (const e of entry) {
    if (!e || typeof e !== "object") continue;
    const changes = (e as Record<string, unknown>).changes as unknown[] | undefined;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      if (!change || typeof change !== "object") continue;
      const value = (change as Record<string, unknown>).value as Record<string, unknown> | undefined;
      if (!value || typeof value !== "object") continue;

      const messages = value.messages as unknown[] | undefined;
      if (!Array.isArray(messages) || messages.length === 0) continue;

      // Take the first text message
      for (const raw of messages) {
        if (!raw || typeof raw !== "object") continue;
        const msg = raw as Record<string, unknown>;
        if (msg.type !== "text") continue;

        const text = msg.text as Record<string, unknown> | undefined;
        if (!text || typeof text !== "object") continue;

        return {
          id: String(msg.id ?? ""),
          channel: "whatsapp",
          peer: { kind: "user", id: String(msg.from ?? "") },
          content: String(text.body ?? ""),
          sender: String(msg.from ?? ""),
          timestamp: new Date(typeof msg.timestamp === "string" ? Number(msg.timestamp) * 1000 : Date.now()),
        };
      }
    }
  }

  return null;
}
