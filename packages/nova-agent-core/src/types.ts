// ─── Agent Core Types ───

import type { Message, ToolCall, TaskType } from "@guiguzi/ai";

export interface AgentConfig {
  systemPrompt?: string;
  maxTurns?: number;
  maxTokens?: number;
  temperature?: number;
  tools?: Tool[];
  modelOverride?: string; // Force specific model
  workspace?: string;     // Working directory
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
  execute: (args: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  workspace: string;
  signal: AbortSignal;
}

export interface ToolResult {
  content: string;
  isError?: boolean;
}

export interface AgentEvent {
  type: "thinking" | "tool_call" | "tool_result" | "text" | "error" | "done";
  content?: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  error?: string;
  model?: string;
  provider?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

// ─── Tree-Structured Conversation ───

export interface ConversationNode {
  id: string;
  parentId: string | null;
  message: Message;
  children: string[];
  metadata?: {
    model?: string;
    provider?: string;
    taskType?: TaskType;
    timestamp?: Date;
    tokens?: number;
  };
}
