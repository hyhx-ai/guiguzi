// ─── Conversation Tree ───
// Tree-structured conversation history with branching support

import { randomUUID } from "node:crypto";
import type { Message } from "@guiguzi/ai";
import type { ConversationNode } from "./types.js";

export class ConversationTree {
  private nodes = new Map<string, ConversationNode>();
  private rootId: string | null = null;
  private currentId: string | null = null;

  // ─── Add Messages ───

  addUserMessage(content: string): string {
    return this.addNode({ role: "user", content });
  }

  addAssistantMessage(content: string, metadata?: ConversationNode["metadata"]): string {
    return this.addNode({ role: "assistant", content }, metadata);
  }

  addToolResult(toolCallId: string, content: string, isError = false): string {
    return this.addNode({
      role: "tool",
      content,
      toolCallId,
    });
  }

  private addNode(message: Message, metadata?: ConversationNode["metadata"]): string {
    const id = randomUUID();
    const node: ConversationNode = {
      id,
      parentId: this.currentId,
      message,
      children: [],
      metadata: { ...metadata, timestamp: new Date() },
    };

    this.nodes.set(id, node);

    if (this.currentId) {
      const parent = this.nodes.get(this.currentId);
      parent?.children.push(id);
    } else {
      this.rootId = id;
    }

    this.currentId = id;
    return id;
  }

  // ─── Navigation ───

  getCurrentId(): string | null {
    return this.currentId;
  }

  setCurrent(id: string): void {
    if (this.nodes.has(id)) {
      this.currentId = id;
    }
  }

  getRoot(): ConversationNode | null {
    return this.rootId ? (this.nodes.get(this.rootId) ?? null) : null;
  }

  getNode(id: string): ConversationNode | null {
    return this.nodes.get(id) ?? null;
  }

  // ─── Linear History ───
  // Get messages from root to current node (for sending to AI)

  getMessages(): Message[] {
    const messages: Message[] = [];
    let nodeId = this.currentId;

    while (nodeId) {
      const node = this.nodes.get(nodeId);
      if (!node) break;
      messages.unshift(node.message);
      nodeId = node.parentId;
    }

    return messages;
  }

  // ─── Branching ───

  branch(parentId: string): string {
    const parent = this.nodes.get(parentId);
    if (!parent) throw new Error(`Node ${parentId} not found`);

    this.currentId = parentId;
    return parentId;
  }

  getChildren(nodeId: string): ConversationNode[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];
    return node.children
      .map((id) => this.nodes.get(id))
      .filter((n): n is ConversationNode => n !== undefined);
  }

  // ─── Context Compression ───
  // Compress older messages to save tokens

  compress(keepRecent = 10): Message[] {
    const messages = this.getMessages();
    if (messages.length <= keepRecent) return messages;

    const oldMessages = messages.slice(0, messages.length - keepRecent);
    const recentMessages = messages.slice(messages.length - keepRecent);

    // Create a summary of old messages
    const summary = oldMessages
      .filter((m) => m.role === "assistant")
      .map((m) => m.content)
      .join("\n---\n");

    const compressedSummary: Message = {
      role: "system",
      content: `[Conversation history summary]\n${summary.slice(0, 2000)}\n[End summary]`,
    };

    return [compressedSummary, ...recentMessages];
  }

  // ─── Stats ───

  getStats(): { totalNodes: number; depth: number; branches: number } {
    let depth = 0;
    let nodeId = this.currentId;
    while (nodeId) {
      const node = this.nodes.get(nodeId);
      if (!node) break;
      depth++;
      nodeId = node.parentId;
    }

    const branches = Array.from(this.nodes.values())
      .filter((n) => n.children.length > 1).length;

    return {
      totalNodes: this.nodes.size,
      depth,
      branches,
    };
  }

  // ─── Serialization ───

  toJSON(): { nodes: ConversationNode[]; rootId: string | null; currentId: string | null } {
    return {
      nodes: Array.from(this.nodes.values()),
      rootId: this.rootId,
      currentId: this.currentId,
    };
  }

  static fromJSON(data: { nodes: ConversationNode[]; rootId: string | null; currentId: string | null }): ConversationTree {
    const tree = new ConversationTree();
    tree.rootId = data.rootId;
    tree.currentId = data.currentId;
    for (const node of data.nodes) {
      tree.nodes.set(node.id, node);
    }
    return tree;
  }
}
