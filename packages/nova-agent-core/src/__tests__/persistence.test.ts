import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConversationStore } from "../persistence.js";
import { ConversationTree } from "../conversation.js";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("ConversationStore", () => {
  let storeDir: string;
  let store: ConversationStore;

  beforeEach(async () => {
    storeDir = await mkdtemp(join(tmpdir(), "novaclaw-persist-test-"));
    store = new ConversationStore({ storageDir: storeDir, format: "json" });
  });

  afterEach(async () => {
    await rm(storeDir, { recursive: true, force: true });
  });

  // ─── Save & Load ───

  it("should save and load a conversation roundtrip", async () => {
    const tree = new ConversationTree();
    tree.addUserMessage("Hello");
    tree.addAssistantMessage("Hi there!");
    tree.addUserMessage("How are you?");

    await store.save("session-1", tree);
    const loaded = await store.load("session-1");

    expect(loaded).not.toBeNull();
    const messages = loaded!.getMessages();
    expect(messages).toHaveLength(3);
    expect(messages[0]!.role).toBe("user");
    expect(messages[0]!.content).toBe("Hello");
    expect(messages[1]!.role).toBe("assistant");
    expect(messages[1]!.content).toBe("Hi there!");
    expect(messages[2]!.role).toBe("user");
    expect(messages[2]!.content).toBe("How are you?");
  });

  it("should preserve currentId after roundtrip", async () => {
    const tree = new ConversationTree();
    tree.addUserMessage("First");
    const secondId = tree.addAssistantMessage("Second");

    await store.save("session-2", tree);
    const loaded = await store.load("session-2");

    expect(loaded).not.toBeNull();
    expect(loaded!.getCurrentId()).toBe(secondId);
  });

  it("should preserve branching after roundtrip", async () => {
    const tree = new ConversationTree();
    const rootId = tree.addUserMessage("Root");
    tree.addAssistantMessage("Branch A");
    tree.branch(rootId);
    tree.addAssistantMessage("Branch B");

    await store.save("session-branch", tree);
    const loaded = await store.load("session-branch");

    expect(loaded).not.toBeNull();
    const stats = loaded!.getStats();
    expect(stats.totalNodes).toBe(3);
    expect(stats.branches).toBe(1);
  });

  it("should save and load an empty tree", async () => {
    const tree = new ConversationTree();

    await store.save("empty-session", tree);
    const loaded = await store.load("empty-session");

    expect(loaded).not.toBeNull();
    expect(loaded!.getMessages()).toHaveLength(0);
    expect(loaded!.getCurrentId()).toBeNull();
  });

  // ─── Load non-existent ───

  it("should return null for non-existent session", async () => {
    const loaded = await store.load("does-not-exist");
    expect(loaded).toBeNull();
  });

  // ─── List ───

  it("should list saved sessions with correct metadata", async () => {
    const tree1 = new ConversationTree();
    tree1.addUserMessage("Hello");
    tree1.addAssistantMessage("Hi");
    await store.save("session-a", tree1);

    const tree2 = new ConversationTree();
    tree2.addUserMessage("One");
    tree2.addAssistantMessage("Two");
    tree2.addUserMessage("Three");
    await store.save("session-b", tree2);

    const sessions = await store.list();
    expect(sessions).toHaveLength(2);

    const ids = sessions.map((s) => s.id).sort();
    expect(ids).toEqual(["session-a", "session-b"]);

    const sessionA = sessions.find((s) => s.id === "session-a")!;
    expect(sessionA.messageCount).toBe(2);
    expect(sessionA.createdAt).toBeTruthy();
    expect(sessionA.updatedAt).toBeTruthy();

    const sessionB = sessions.find((s) => s.id === "session-b")!;
    expect(sessionB.messageCount).toBe(3);
  });

  it("should return empty list when no sessions exist", async () => {
    const sessions = await store.list();
    expect(sessions).toEqual([]);
  });

  it("should return empty list when directory does not exist", async () => {
    const emptyStore = new ConversationStore({
      storageDir: join(storeDir, "nonexistent-subdir"),
      format: "json",
    });
    const sessions = await emptyStore.list();
    expect(sessions).toEqual([]);
  });

  // ─── Delete ───

  it("should delete an existing session and return true", async () => {
    const tree = new ConversationTree();
    tree.addUserMessage("To be deleted");
    await store.save("delete-me", tree);

    expect(await store.exists("delete-me")).toBe(true);

    const result = await store.delete("delete-me");
    expect(result).toBe(true);
    expect(await store.exists("delete-me")).toBe(false);
  });

  it("should return false when deleting non-existent session", async () => {
    const result = await store.delete("ghost-session");
    expect(result).toBe(false);
  });

  // ─── Exists ───

  it("should return true for existing session", async () => {
    const tree = new ConversationTree();
    tree.addUserMessage("Check me");
    await store.save("exists-test", tree);

    expect(await store.exists("exists-test")).toBe(true);
  });

  it("should return false for non-existent session", async () => {
    expect(await store.exists("nope")).toBe(false);
  });

  // ─── Directory creation ───

  it("should create storage directory if it does not exist on save", async () => {
    const nestedDir = join(storeDir, "deep", "nested", "dir");
    const nestedStore = new ConversationStore({ storageDir: nestedDir, format: "json" });

    const tree = new ConversationTree();
    tree.addUserMessage("Nested save");
    await nestedStore.save("nested-session", tree);

    const loaded = await nestedStore.load("nested-session");
    expect(loaded).not.toBeNull();
    expect(loaded!.getMessages()).toHaveLength(1);
  });

  // ─── Corrupt file handling ───

  it("should return null when loading a corrupt JSON file", async () => {
    const corruptPath = join(storeDir, "corrupt.json");
    await mkdir(storeDir, { recursive: true });
    await writeFile(corruptPath, "{ this is not valid json !!!", "utf-8");

    // The file exists as corrupt.json but we need to access it via the store
    // The store looks for {sessionId}.json, so sessionId = "corrupt"
    const loaded = await store.load("corrupt");
    expect(loaded).toBeNull();
  });

  it("should return null when loading a file with invalid tree structure", async () => {
    const badPath = join(storeDir, "bad-structure.json");
    await mkdir(storeDir, { recursive: true });
    await writeFile(badPath, JSON.stringify({ sessionId: "bad-structure", tree: "not-an-object" }), "utf-8");

    const loaded = await store.load("bad-structure");
    expect(loaded).toBeNull();
  });

  // ─── Overwrite ───

  it("should overwrite an existing session on save", async () => {
    const tree1 = new ConversationTree();
    tree1.addUserMessage("Version 1");
    await store.save("overwrite-test", tree1);

    const tree2 = new ConversationTree();
    tree2.addUserMessage("Version 1");
    tree2.addAssistantMessage("Version 2 response");
    await store.save("overwrite-test", tree2);

    const loaded = await store.load("overwrite-test");
    expect(loaded).not.toBeNull();
    expect(loaded!.getMessages()).toHaveLength(2);
    expect(loaded!.getMessages()[1]!.content).toBe("Version 2 response");
  });

  // ─── Tool results persistence ───

  it("should persist tool result messages", async () => {
    const tree = new ConversationTree();
    tree.addUserMessage("Read the file");
    tree.addAssistantMessage("Let me read it");
    tree.addToolResult("call-abc", "file contents here");

    await store.save("tool-session", tree);
    const loaded = await store.load("tool-session");

    expect(loaded).not.toBeNull();
    const messages = loaded!.getMessages();
    expect(messages).toHaveLength(3);
    expect(messages[2]!.role).toBe("tool");
    expect(messages[2]!.content).toBe("file contents here");
  });

  // ─── List skips corrupt files ───

  it("should skip corrupt files when listing sessions", async () => {
    // Save a valid session
    const tree = new ConversationTree();
    tree.addUserMessage("Valid");
    await store.save("valid-session", tree);

    // Write a corrupt file
    await writeFile(join(storeDir, "corrupt-file.json"), "not json", "utf-8");

    const sessions = await store.list();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.id).toBe("valid-session");
  });
});
