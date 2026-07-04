// ─── Agent ───
// Main agent loop: orchestrates AI calls, tool execution, and conversation management

import { resolve } from "node:path";
import type { AIProvider, ChatOptions, Message, StreamChunk } from "@novaclaw/ai";
import { AIRouter } from "@novaclaw/router";
import { ToolExecutor } from "./tools.js";
import { ConversationTree } from "./conversation.js";
import type { AgentConfig, AgentEvent, ToolResult } from "./types.js";

const DEFAULT_SYSTEM_PROMPT = `You are NovaClaw, an AI coding assistant. You help users write, debug, and improve code.

You have access to these tools:
- read: Read file contents
- write: Create/overwrite files
- edit: Make precise text replacements
- bash: Execute shell commands

Be concise. Write clean code. Explain your reasoning briefly.
When making changes, prefer edit over write for surgical modifications.`;

export class Agent {
  private config: AgentConfig;
  private toolExecutor: ToolExecutor;
  private conversation: ConversationTree;
  private router: AIRouter;
  private abortController: AbortController | null = null;

  constructor(config: AgentConfig = {}, router: AIRouter) {
    this.config = config;
    this.toolExecutor = new ToolExecutor();
    this.conversation = new ConversationTree();
    this.router = router;

    // Register custom tools
    if (config.tools) {
      for (const tool of config.tools) {
        this.toolExecutor.register(tool);
      }
    }
  }

  // ─── Main Agent Loop ───

  async *run(userMessage: string): AsyncIterable<AgentEvent> {
    this.abortController = new AbortController();
    const workspace = resolve(this.config.workspace ?? process.cwd());

    // Add user message to conversation
    this.conversation.addUserMessage(userMessage);

    let turnCount = 0;
    const maxTurns = this.config.maxTurns ?? 20;

    while (turnCount < maxTurns) {
      turnCount++;

      // Route to best model
      const messages = this.conversation.getMessages();
      const decision = await this.router.route(messages);

      if (decision.providerId === "none") {
        yield { type: "error", error: "No AI model available. Check your API keys or start Ollama." };
        break;
      }

      yield {
        type: "thinking",
        model: decision.modelId,
        provider: decision.providerId,
        content: `[${decision.strategy}] ${decision.reason}`,
      };

      // Build chat options
      const chatOptions: ChatOptions = {
        model: decision.modelId.split(":")[1] ?? decision.modelId,
        messages: [
          { role: "system", content: this.config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT },
          ...this.conversation.compress(),
        ],
        temperature: this.config.temperature ?? 0.7,
        maxTokens: this.config.maxTokens ?? 8192,
        tools: this.toolExecutor.getAll().map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
        stream: true,
      };

      // Get the provider
      const registry = (await import("@novaclaw/ai")).getProviderRegistry();
      const provider = registry.get(decision.providerId);
      if (!provider) {
        yield { type: "error", error: `Provider ${decision.providerId} not found` };
        break;
      }

      // Stream response
      let assistantContent = "";
      let pendingToolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];

      try {
        for await (const chunk of provider.chatStream(chatOptions)) {
          if (this.abortController.signal.aborted) {
            yield { type: "done", content: "Aborted by user" };
            return;
          }

          switch (chunk.type) {
            case "text":
              assistantContent += chunk.text ?? "";
              yield { type: "text", content: chunk.text };
              break;

            case "tool_call":
              if (chunk.toolCall?.id && chunk.toolCall?.name && chunk.toolCall?.arguments) {
                pendingToolCalls.push({
                  id: chunk.toolCall.id,
                  name: chunk.toolCall.name,
                  arguments: chunk.toolCall.arguments,
                });
                yield {
                  type: "tool_call",
                  toolCall: {
                    id: chunk.toolCall.id,
                    name: chunk.toolCall.name,
                    arguments: chunk.toolCall.arguments,
                  },
                };
              }
              break;

            case "done":
              if (chunk.usage) {
                yield { type: "done", usage: chunk.usage };
                this.router.recordCost(
                  (chunk.usage.totalTokens / 1_000_000) * decision.model.costPerMInput
                );
              }
              break;

            case "error":
              yield { type: "error", error: chunk.error };
              break;
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        yield { type: "error", error: `Provider error: ${msg}` };
        break;
      }

      // Save assistant message
      this.conversation.addAssistantMessage(assistantContent, {
        model: decision.modelId,
        provider: decision.providerId,
      });

      // Execute tool calls
      if (pendingToolCalls.length > 0) {
        for (const tc of pendingToolCalls) {
          yield {
            type: "tool_call",
            toolCall: { id: tc.id, name: tc.name, arguments: tc.arguments },
          };

          const result = await this.toolExecutor.execute(tc.name, tc.arguments, {
            workspace,
            signal: this.abortController.signal,
          });

          this.conversation.addToolResult(tc.id, result.content, result.isError);

          yield {
            type: "tool_result",
            toolCall: { id: tc.id, name: tc.name, arguments: tc.arguments },
            toolResult: result,
          };
        }
        // Continue the loop for follow-up response
        continue;
      }

      // No tool calls = we're done
      break;
    }

    if (turnCount >= maxTurns) {
      yield { type: "error", error: `Max turns (${maxTurns}) reached` };
    }
  }

  // ─── Control ───

  abort(): void {
    this.abortController?.abort();
  }

  getConversation(): ConversationTree {
    return this.conversation;
  }

  getStats(): {
    conversation: ReturnType<ConversationTree["getStats"]>;
    dailySpent: number;
  } {
    return {
      conversation: this.conversation.getStats(),
      dailySpent: this.router.getDailySpent(),
    };
  }
}
