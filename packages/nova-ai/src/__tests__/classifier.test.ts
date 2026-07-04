import { describe, it, expect } from "vitest";
import { classifyTask, classifyWithContext } from "../classifier.js";
import type { Message } from "../index.js";

function msg(content: string): Message[] {
  return [{ role: "user", content }];
}

describe("classifyTask", () => {
  it("should classify debug tasks", () => {
    const result = classifyTask(msg("fix the bug in authentication module"));
    expect(result.type).toBe("debug");
    expect(result.confidence).toBeGreaterThan(0.3);
    expect(result.keywords).toContain("bug");
  });

  it("should classify code creation tasks", () => {
    const result = classifyTask(msg("write a function to sort an array"));
    expect(result.type).toBe("code");
    expect(result.keywords.length).toBeGreaterThan(0);
  });

  it("should classify test tasks", () => {
    const result = classifyTask(msg("write unit test for the login handler"));
    expect(result.type).toBe("test");
  });

  it("should classify refactor tasks", () => {
    const result = classifyTask(msg("refactor this module to simplify the logic"));
    expect(result.type).toBe("refactor");
  });

  it("should classify doc tasks", () => {
    const result = classifyTask(msg("add documentation for the API endpoints"));
    expect(result.type).toBe("doc");
  });

  it("should classify architecture tasks", () => {
    const result = classifyTask(msg("design the system architecture for microservice migration"));
    // Could be arch or complex-code, both valid
    expect(["arch", "complex-code"]).toContain(result.type);
  });

  it("should handle Chinese input", () => {
    const result = classifyTask(msg("修复这个报错问题"));
    expect(result.type).toBe("debug");
    expect(result.keywords.length).toBeGreaterThan(0);
  });

  it("should default to simple for unrecognized input", () => {
    const result = classifyTask(msg("hello there"));
    expect(result.type).toBe("simple");
  });

  it("should handle empty messages array", () => {
    const result = classifyTask([]);
    expect(result.type).toBe("simple");
    expect(result.confidence).toBe(0.5);
  });

  it("should use the last user message for classification", () => {
    const messages: Message[] = [
      { role: "user", content: "write a function" },
      { role: "assistant", content: "Sure, here it is..." },
      { role: "user", content: "now fix the bug in it" },
    ];
    const result = classifyTask(messages);
    expect(result.type).toBe("debug");
  });

  it("should return confidence between 0 and 1", () => {
    const result = classifyTask(msg("fix the error"));
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

describe("classifyWithContext", () => {
  it("should boost confidence for large files", () => {
    const base = classifyTask(msg("write a function"));
    const enhanced = classifyWithContext(
      msg("write a function"),
      { path: "src/handler.ts", language: "typescript", size: 1000 }
    );
    expect(enhanced.confidence).toBeGreaterThanOrEqual(base.confidence);
  });

  it("should reclassify code→test for test file paths", () => {
    const result = classifyWithContext(
      msg("write a function to validate input"),
      { path: "src/handler.test.ts", language: "typescript", size: 100 }
    );
    expect(result.type).toBe("test");
  });
});
