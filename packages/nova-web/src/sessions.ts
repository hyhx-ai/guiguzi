// ─── Session Management ───
// Manages chat sessions and their messages

import { randomUUID } from "node:crypto";

// ─── Interfaces ───────────────────────────────────────────────

export interface Session {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// ─── Session Manager ──────────────────────────────────────────

export class SessionManager {
  private sessions = new Map<string, Session>();
  private messages = new Map<string, ChatMessage[]>();

  createSession(name?: string): Session {
    const id = randomUUID();
    const now = new Date();
    const session: Session = {
      id,
      name: name ?? `Session ${id.slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    };
    this.sessions.set(id, session);
    this.messages.set(id, []);
    return session;
  }

  getSession(id: string): Session | null {
    return this.sessions.get(id) ?? null;
  }

  listSessions(): Session[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );
  }

  deleteSession(id: string): boolean {
    const existed = this.sessions.delete(id);
    this.messages.delete(id);
    return existed;
  }

  addMessage(sessionId: string, message: ChatMessage): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const msgs = this.messages.get(sessionId);
    if (!msgs) {
      throw new Error(`Message store not found for session: ${sessionId}`);
    }

    msgs.push(message);
    session.messageCount = msgs.length;
    session.updatedAt = new Date();
  }

  getMessages(sessionId: string): ChatMessage[] {
    const msgs = this.messages.get(sessionId);
    if (!msgs) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return [...msgs];
  }
}
