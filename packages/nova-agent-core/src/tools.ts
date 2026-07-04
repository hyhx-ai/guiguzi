// ─── Tool Executor ───
// Built-in tools: read, write, edit, bash

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Tool, ToolContext, ToolResult } from "./types.js";

const execAsync = promisify(exec);

export class ToolExecutor {
  private tools = new Map<string, Tool>();

  constructor() {
    this.registerBuiltinTools();
  }

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  async execute(name: string, args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { content: `Error: Unknown tool "${name}"`, isError: true };
    }

    try {
      // Path protection: ensure file operations stay within workspace
      if (["read", "write", "edit"].includes(name)) {
        const filePath = args["path"] as string;
        if (filePath) {
          const resolved = resolve(context.workspace, filePath);
          if (!resolved.startsWith(resolve(context.workspace))) {
            return { content: `Error: Path "${filePath}" is outside workspace`, isError: true };
          }
          args["path"] = resolved;
        }
      }

      return await tool.execute(args, context);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: `Error: ${message}`, isError: true };
    }
  }

  private registerBuiltinTools(): void {
    // ─── read: Read files & search code ───
    this.register({
      name: "read",
      description: "Read the contents of a file. Supports text files and images.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to workspace" },
          offset: { type: "number", description: "Start line (1-indexed)" },
          limit: { type: "number", description: "Number of lines to read" },
        },
        required: ["path"],
      },
      async execute(args, _context): Promise<ToolResult> {
        const filePath = args["path"] as string;
        try {
          const content = await readFile(filePath, "utf-8");
          const lines = content.split("\n");
          const offset = ((args["offset"] as number) ?? 1) - 1;
          const limit = (args["limit"] as number) ?? lines.length;
          const sliced = lines.slice(offset, offset + limit);

          const numbered = sliced.map((line, i) =>
            `${String(offset + i + 1).padStart(4)} | ${line}`
          ).join("\n");

          return { content: numbered || "(empty file)" };
        } catch (error) {
          return { content: `Cannot read file: ${error instanceof Error ? error.message : String(error)}`, isError: true };
        }
      },
    });

    // ─── write: Create & overwrite files ───
    this.register({
      name: "write",
      description: "Write content to a file. Creates parent directories if needed.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to workspace" },
          content: { type: "string", description: "Content to write" },
        },
        required: ["path", "content"],
      },
      async execute(args, _context): Promise<ToolResult> {
        const filePath = args["path"] as string;
        const content = args["content"] as string;
        try {
          await mkdir(dirname(filePath), { recursive: true });
          await writeFile(filePath, content, "utf-8");
          return { content: `File written: ${filePath} (${content.length} bytes)` };
        } catch (error) {
          return { content: `Cannot write file: ${error instanceof Error ? error.message : String(error)}`, isError: true };
        }
      },
    });

    // ─── edit: Surgical text replacement ───
    this.register({
      name: "edit",
      description: "Make precise edits to a file by replacing exact text matches.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to workspace" },
          oldText: { type: "string", description: "Exact text to find" },
          newText: { type: "string", description: "Text to replace with" },
        },
        required: ["path", "oldText", "newText"],
      },
      async execute(args, _context): Promise<ToolResult> {
        const filePath = args["path"] as string;
        const oldText = args["oldText"] as string;
        const newText = args["newText"] as string;
        try {
          const content = await readFile(filePath, "utf-8");
          if (!content.includes(oldText)) {
            return { content: "Error: oldText not found in file", isError: true };
          }
          const updated = content.replace(oldText, newText);
          await writeFile(filePath, updated, "utf-8");
          return { content: `Edit applied to ${filePath}` };
        } catch (error) {
          return { content: `Cannot edit file: ${error instanceof Error ? error.message : String(error)}`, isError: true };
        }
      },
    });

    // ─── bash: Execute shell commands ───
    this.register({
      name: "bash",
      description: "Execute a shell command in the workspace directory.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to execute" },
          timeout: { type: "number", description: "Timeout in milliseconds (default: 30000)" },
        },
        required: ["command"],
      },
      async execute(args, context): Promise<ToolResult> {
        const command = args["command"] as string;
        const timeout = (args["timeout"] as number) ?? 30000;
        try {
          const { stdout, stderr } = await execAsync(command, {
            cwd: context.workspace,
            timeout,
            signal: context.signal,
            env: { ...process.env },
          });
          const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : "");
          return { content: output || "(no output)" };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return { content: `Command failed: ${msg}`, isError: true };
        }
      },
    });
  }
}
