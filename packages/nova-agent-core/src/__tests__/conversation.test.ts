import { describe, it, expect } from "vitest";
import { ConversationTree } from "../conversation.js";

describe("ConversationTree", () => {
  it("should add user messages", () => {
    const tree = new ConversationTree();
    const id = tree.addUserMessage("Hello");
    expect(id).toBeTruthy();
    expect(tree.getCurrentId()).toBe(id);
  });

  it("should build linear conversation", () => {
    const tree = new ConversationTree();
    tree.addUserMessage("Hi");
    tree.addAssistantMessage("Hello!");
    tree.addUserMessage("How are you?");

    const messages = tree.getMessages();
    expect(messages).toHaveLength(3);
    expect(messages[0]!.role).toBe("user");
    expect(messages[0]!.content).toBe("Hi");
    expect(messages[1]!.role).toBe("assistant");
    expect(messages[2]!.role).toBe("user");
    expect(messages[2]!.content).toBe("How are you?");
  });

  it("should track stats correctly", () => {
    const tree = new ConversationTree();
    tree.addUserMessage("A");
    tree.addAssistantMessage("B");
    tree.addUserMessage("C");

    const stats = tree.getStats();
    expect(stats.totalNodes).toBe(3);
    expect(stats.depth).toBe(3);
    expect(stats.branches).toBe(0);
  });

  it("should support branching", () => {
    const tree = new ConversationTree();
    const rootId = tree.addUserMessage("Start");
    tree.addAssistantMessage("Response A");

    // Branch from root
    tree.branch(rootId);
    tree.addAssistantMessage("Response B");

    const stats = tree.getStats();
    expect(stats.totalNodes).toBe(3);
    expect(stats.branches).toBe(1); // root has 2 children

    // Current path should be root → Response B
    const messages = tree.getMessages();
    expect(messages).toHaveLength(2);
    expect(messages[1]!.content).toBe("Response B");
  });

  it("should navigate with setCurrent", () => {
    const tree = new ConversationTree();
    const id1 = tree.addUserMessage("First");
    const id2 = tree.addAssistantMessage("Second");

    tree.setCurrent(id1);
    expect(tree.getCurrentId()).toBe(id1);

    const messages = tree.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0]!.content).toBe("First");
  });

  it("should compress old messages", () => {
    const tree = new ConversationTree();
    // Add 15 messages
    for (let i = 0; i < 15; i++) {
      tree.addUserMessage(`User message ${i}`);
      tree.addAssistantMessage(`Assistant response ${i}`);
    }

    const compressed = tree.compress(6);
    // Should have summary + 6 recent messages
    expect(compressed.length).toBeLessThanOrEqual(7);
    expect(compressed[0]!.role).toBe("system"); // Summary
    expect(compressed[0]!.content).toContain("Conversation history summary");
  });

  it("should serialize and deserialize", () => {
    const tree = new ConversationTree();
    tree.addUserMessage("Hello");
    tree.addAssistantMessage("Hi there");

    const json = tree.toJSON();
    const restored = ConversationTree.fromJSON(json);

    expect(restored.getMessages()).toHaveLength(2);
    expect(restored.getCurrentId()).toBe(tree.getCurrentId());
  });

  it("should get children of a node", () => {
    const tree = new ConversationTree();
    const rootId = tree.addUserMessage("Root");
    tree.addAssistantMessage("Child A");
    tree.branch(rootId);
    tree.addAssistantMessage("Child B");

    const children = tree.getChildren(rootId);
    expect(children).toHaveLength(2);
  });

  it("should add tool results", () => {
    const tree = new ConversationTree();
    tree.addUserMessage("Read the file");
    tree.addAssistantMessage("Let me read it");
    const id = tree.addToolResult("call-123", "file contents here");

    const node = tree.getNode(id);
    expect(node).toBeTruthy();
    expect(node!.message.role).toBe("tool");
    expect(node!.message.toolCallId).toBe("call-123");
  });

  it("should return null for non-existent nodes", () => {
    const tree = new ConversationTree();
    expect(tree.getNode("non-existent")).toBeNull();
  });

  it("should throw on branch to non-existent node", () => {
    const tree = new ConversationTree();
    expect(() => tree.branch("non-existent")).toThrow("not found");
  });
});
