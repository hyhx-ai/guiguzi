// ─── Cross-Channel Session Synchronization ───
// Links multiple channel peers to a single session for unified context

export interface ChannelLink {
  channel: string;
  peerId: string;
  linkedAt: Date;
}

export class SessionSync {
  /** sessionId → channel links */
  private sessions = new Map<string, ChannelLink[]>();

  /** reverse index: "channel:peerId" → sessionId */
  private reverseIndex = new Map<string, string>();

  /**
   * Link multiple channel peers to one session.
   * Replaces any existing links for this session ID.
   */
  linkSession(sessionId: string, channels: ChannelLink[]): void {
    // Remove old reverse-index entries for this session
    const existing = this.sessions.get(sessionId);
    if (existing) {
      for (const link of existing) {
        this.reverseIndex.delete(this.makeKey(link.channel, link.peerId));
      }
    }

    // Store new links
    this.sessions.set(sessionId, [...channels]);

    // Build reverse index entries
    for (const link of channels) {
      this.reverseIndex.set(this.makeKey(link.channel, link.peerId), sessionId);
    }
  }

  /**
   * Get all channel links for a session.
   */
  getLinks(sessionId: string): ChannelLink[] {
    return this.sessions.get(sessionId) ?? [];
  }

  /**
   * Find the session ID for a given channel + peer combination.
   * Returns null if no session is linked.
   */
  resolveSession(channel: string, peerId: string): string | null {
    return this.reverseIndex.get(this.makeKey(channel, peerId)) ?? null;
  }

  /**
   * Remove all links for a session.
   */
  unlinkSession(sessionId: string): void {
    const links = this.sessions.get(sessionId);
    if (links) {
      for (const link of links) {
        this.reverseIndex.delete(this.makeKey(link.channel, link.peerId));
      }
      this.sessions.delete(sessionId);
    }
  }

  /**
   * List all active session IDs.
   */
  getActiveSessions(): string[] {
    return [...this.sessions.keys()];
  }

  /**
   * Create a composite key for the reverse index.
   */
  private makeKey(channel: string, peerId: string): string {
    return `${channel}:${peerId}`;
  }
}
