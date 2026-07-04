import type { GatewayMessage } from "../index.js";

/**
 * Parse a Twilio SMS webhook into a GatewayMessage.
 *
 * Twilio sends (form-encoded, parsed as JSON here):
 *   { SmsMessageSid, From, Body, To, AccountSid }
 *
 * Returns null if required fields are missing.
 */
export function parseSmsWebhook(body: unknown): GatewayMessage | null {
  if (!body || typeof body !== "object") return null;

  const obj = body as Record<string, unknown>;

  // Must have a message SID and body text
  if (typeof obj.SmsMessageSid !== "string") return null;
  if (typeof obj.Body !== "string") return null;

  return {
    id: String(obj.SmsMessageSid ?? ""),
    channel: "sms",
    peer: { kind: "user", id: String(obj.From ?? "") },
    content: String(obj.Body ?? ""),
    sender: String(obj.From ?? ""),
    timestamp: new Date(),
  };
}
