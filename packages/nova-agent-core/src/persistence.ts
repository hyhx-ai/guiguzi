// ─── Conversation Persistence ───
// Save and load conversation trees to/from disk as JSON files

import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ConversationTree } from "./conversation.js";

// ─── Types ───

export interface PersistenceConfig {
  storageDir: string;
  format: "json";
}

export interface SessionInfo {
  id: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

// ─── Serialized format on disk ───

interface SerializedSession {
  sessionId: string;
  tree: ReturnType<ConversationTree["toJSON"]>;
}

// ─── ConversationStore ───

export class ConversationStore {
  private storageDir: string;

  constructor(config: PersistenceConfig) {
    this.storageDir = resolve(config.storageDir);
  }

  private filePath(sessionId: string): string {
    return join(this.storageDir, `${sessionId}.json`);
  }

  // ─── Save ───

  async save(sessionId: string, tree: ConversationTree): Promise<void> {
    await mkdir(this.storageDir, { recursive: true });

    const data: SerializedSession = {
      sessionId,
      tree: tree.toJSON(),
    };

    await writeFile(this.filePath(sessionId), JSON.stringify(data, null, 2), "utf-8");
  }

  // ─── Load ───

  async load(sessionId: string): Promise<ConversationTree | null> {
    try {
      const raw = await readFile(this.filePath(sessionId), "utf-8");
      const data: SerializedSession = JSON.parse(raw);

      if (!data.tree || !Array.isArray(data.tree.nodes)) {
        return null;
      }

      return ConversationTree.fromJSON(data.tree);
    } catch {
      // File not found, corrupt JSON, or invalid structure
      return null;
    }
  }

  // ─── List ───

  async list(): Promise<SessionInfo[]> {
    try {
      const files = await readdir(this.storageDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      const results = await Promise.all(
        jsonFiles.map(async (file): Promise<SessionInfo | null> => {
          try {
            const id = file.replace(/\.json$/, "");
            const fullPath = join(this.storageDir, file);
            const fileStat = await stat(fullPath);
            const raw = await readFile(fullPath, "utf-8");
            const data: SerializedSession = JSON.parse(raw);

            if (!data.tree || !Array.isArray(data.tree.nodes)) {
              return null;
            }

            const messageCount = data.tree.nodes.length;

            // Extract timestamps from tree nodes
            const rawTimestamps = data.tree.nodes
              .map((n) => n.metadata?.timestamp)
              .filter((t) => t != null);

            const timestamps = rawTimestamps.map((t) =>
              t instanceof Date ? t.toISOString() : String(t),
            );

            const createdAt = timestamps.length > 0
              ? timestamps[0]!
              : fileStat.birthtime.toISOString();

            const updatedAt = timestamps.length > 0
              ? timestamps[timestamps.length - 1]!
              : fileStat.mtime.toISOString();

            return { id, createdAt, updatedAt, messageCount };
          } catch {
            return null;
          }
        }),
      );

      return results.filter((r): r is SessionInfo => r !== null);
    } catch {
      // Directory doesn't exist or can't be read
      return [];
    }
  }

  // ─── Delete ───

  async delete(sessionId: string): Promise<boolean> {
    try {
      await rm(this.filePath(sessionId));
      return true;
    } catch {
      return false;
    }
  }

  // ─── Exists ───

  async exists(sessionId: string): Promise<boolean> {
    try {
      await stat(this.filePath(sessionId));
      return true;
    } catch {
      return false;
    }
  }
}
