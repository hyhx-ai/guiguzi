import type { GatewayMessage } from "../index.js";

/**
 * Parse a Nostr NIP-04 encrypted DM event into a GatewayMessage.
 *
 * Nostr sends:
 *   { id, kind: 4, pubkey, content, created_at, tags: [["p", recipientPubkey]] }
 *
 * Returns null for non-kind-4 events (kind 0 = metadata, kind 1 = text note, etc.).
 * Note: content is typically encrypted; decryption happens outside the parser.
 */
export function parseNostrEvent(body: unknown): GatewayMessage | null {
  if (!body || typeof body !== "object") return null;

  const obj = body as Record<string, unknown>;

  // Only handle kind 4 (encrypted DM)
  if (obj.kind !== 4) return null;

  if (typeof obj.id !== "string") return null;
  if (typeof obj.pubkey !== "string") return null;

  // Extract the recipient pubkey from tags [["p", ...]]
  const tags = obj.tags as unknown[][] | undefined;
  let recipientPubkey = "";
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      if (Array.isArray(tag) && tag[0] === "p" && typeof tag[1] === "string") {
        recipientPubkey = tag[1];
        break;
      }
    }
  }

  return {
    id: String(obj.id ?? ""),
    channel: "nostr",
    peer: { kind: "user", id: recipientPubkey || String(obj.pubkey ?? "") },
    content: String(obj.content ?? ""),
    sender: String(obj.pubkey ?? ""),
    timestamp: new Date(typeof obj.created_at === "number" ? obj.created_at * 1000 : Date.now()),
  };
}
