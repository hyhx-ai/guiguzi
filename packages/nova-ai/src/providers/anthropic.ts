// ─── Anthropic Provider ───

import type {
  AIProvider, ChatOptions, ChatResponse, StreamChunk,
  ProviderConfig, ProviderHealth, ModelInfo, Message,
} from "../index.js";

const DEFAULT_BASE_URL = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";

const ANTHROPIC_MODELS: ModelInfo[] = [
  { id: "claude-4-opus", name: "Claude 4 Opus", contextWindow: 200000, costPerMInput: 15, costPerMOutput: 75, capabilities: ["complex-code", "review", "arch", "debug"], quality: 98, speed: 85 },
  { id: "claude-4-sonnet", name: "Claude 4 Sonnet", contextWindow: 200000, costPerMInput: 3, costPerMOutput: 15, capabilities: ["code", "debug", "review", "refactor", "test"], quality: 94, speed: 90 },
  { id: "claude-4-haiku", name: "Claude 4 Haiku", contextWindow: 200000, costPerMInput: 0.25, costPerMOutput: 1.25, capabilities: ["code", "simple", "doc", "autocomplete"], quality: 85, speed: 95 },
];

export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic";
  readonly name = "Anthropic";
  readonly models: ModelInfo[];

  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;

  private _latencyMs = 0;
  private _errorCount = 0;
  private _requestCount = 0;
  private _lastChecked = new Date();

  constructor(config: ProviderConfig = {}) {
    this.apiKey = config.apiKey ?? process.env["ANTHROPIC_API_KEY"] ?? "";
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.timeout = config.timeout ?? 60000;
    this.maxRetries = config.maxRetries ?? 3;
    this.models = ANTHROPIC_MODELS;
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const body = this.buildRequestBody(options, false);
    const response = await this.fetchWithRetry("/v1/messages", body);
    const data = (await response.json()) as AnthropicMessagesResponse;

    const textBlock = data.content.find((b) => b.type === "text");
    const toolUseBlock = data.content.find((b) => b.type === "tool_use");

    return {
      id: data.id,
      provider: this.id,
      model: data.model,
      message: {
        role: "assistant",
        content: textBlock?.text ?? "",
        toolCalls: toolUseBlock ? [{
          id: toolUseBlock.id,
          name: toolUseBlock.name,
          arguments: toolUseBlock.input as Record<string, unknown>,
        }] : undefined,
      },
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      finishReason: data.stop_reason === "end_turn" ? "stop"
        : data.stop_reason === "tool_use" ? "tool_calls"
        : data.stop_reason === "max_tokens" ? "length"
        : "error",
    };
  }

  async *chatStream(options: ChatOptions): AsyncIterable<StreamChunk> {
    const body = this.buildRequestBody(options, true);
    const response = await this.fetchWithRetry("/v1/messages", body);

    if (!response.body) throw new Error("No response body for streaming");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        try {
          const json = JSON.parse(trimmed.slice(6)) as AnthropicStreamEvent;

          if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
            yield { type: "text", text: json.delta.text };
          }
          if (json.type === "content_block_start" && json.content_block?.type === "tool_use") {
            yield {
              type: "tool_call",
              toolCall: {
                id: json.content_block.id,
                name: json.content_block.name,
              },
            };
          }
          if (json.type === "message_delta" && json.usage) {
            yield {
              type: "done",
              usage: {
                promptTokens: 0,
                completionTokens: json.usage.output_tokens,
                totalTokens: json.usage.output_tokens,
              },
            };
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async getHealth(): Promise<ProviderHealth> {
    const errorRate = this._requestCount > 0 ? this._errorCount / this._requestCount : 0;
    return {
      provider: this.id,
      status: errorRate > 0.5 ? "unavailable" : errorRate > 0.1 ? "degraded" : "healthy",
      latencyMs: this._latencyMs,
      lastChecked: this._lastChecked,
      errorRate,
    };
  }

  // ─── Private ───

  private buildRequestBody(options: ChatOptions, stream: boolean): Record<string, unknown> {
    // Extract system message
    const systemMsg = options.messages.find((m) => m.role === "system");
    const nonSystemMsgs = options.messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model: options.model,
      max_tokens: options.maxTokens ?? 8192,
      messages: nonSystemMsgs.map((m) => this.mapMessage(m)),
      stream,
    };

    if (systemMsg) body.system = systemMsg.content;
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.topP !== undefined) body.top_p = options.topP;
    if (options.stop) body.stop_sequences = options.stop;

    if (options.tools?.length) {
      body.tools = options.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    return body;
  }

  private mapMessage(msg: Message): Record<string, unknown> {
    if (msg.role === "tool") {
      return {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: msg.toolCallId, content: msg.content }],
      };
    }

    if (msg.toolCalls?.length) {
      const content: unknown[] = [];
      if (msg.content) content.push({ type: "text", text: msg.content });
      for (const tc of msg.toolCalls) {
        content.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.arguments });
      }
      return { role: msg.role === "user" ? "user" : "assistant", content };
    }

    return { role: msg.role === "user" ? "user" : "assistant", content: msg.content };
  }

  private async fetchWithRetry(path: string, body: Record<string, unknown>): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    };

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        this._latencyMs = Date.now() - start;
        this._requestCount++;
        this._lastChecked = new Date();

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
        }
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this._errorCount++;
        this._requestCount++;
        this._lastChecked = new Date();
        if (attempt < this.maxRetries) {
          await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 10000)));
        }
      }
    }
    throw lastError ?? new Error("Anthropic request failed");
  }
}

// ─── Anthropic API Types ───

interface AnthropicMessagesResponse {
  id: string;
  model: string;
  content: Array<
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: unknown }
  >;
  stop_reason: string | null;
  usage: { input_tokens: number; output_tokens: number };
}

interface AnthropicStreamEvent {
  type: string;
  delta?: { type: string; text?: string };
  content_block?: { type: string; id?: string; name?: string };
  usage?: { output_tokens: number };
}
