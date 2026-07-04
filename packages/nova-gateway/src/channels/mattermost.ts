import type { GatewayMessage } from "../index.js";

/**
 * Parse a Mattermost webhook event into a GatewayMessage.
 *
 * Mattermost sends:
 *   { event: "posted", data: { post: { id, message, user_id, channel_id, create_at } } }
 *
 * Returns null for non-posted events (typing, status_change, etc.).
 */
export function parseMattermostEvent(body: unknown): GatewayMessage | null {
  if (!body || typeof body !== "object") return null;

  const obj = body as Record<string, unknown>;

  // Only handle "posted" events
  if (obj.event !== "posted") return null;

  const data = obj.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== "object") return null;

  // The post is a JSON string inside data.post
  let post: Record<string, unknown>;
  if (typeof data.post === "string") {
    try {
      post = JSON.parse(data.post) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof data.post === "object" && data.post !== null) {
    post = data.post as Record<string, unknown>;
  } else {
    return null;
  }

  // Ignore system messages or messages without content
  if (typeof post.message !== "string" || post.message.length === 0) return null;

  // create_at is a Unix timestamp in milliseconds
  const createAt = typeof post.create_at === "number" ? post.create_at : Date.now();

  return {
    id: String(post.id ?? ""),
    channel: "mattermost",
    peer: { kind: "group", id: String(post.channel_id ?? "") },
    content: String(post.message ?? ""),
    sender: String(post.user_id ?? ""),
    timestamp: new Date(createAt),
  };
}
