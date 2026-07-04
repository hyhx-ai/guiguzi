// ─── OpenAI-Compatible Provider ───
// Works with OpenAI, Azure, Qwen, DeepSeek, and any OpenAI-compatible API

import type {
  AIProvider, ChatOptions, ChatResponse, StreamChunk,
  ProviderConfig, ProviderHealth, ModelInfo, Message,
} from "../index.js";

export interface OpenAIProviderConfig extends ProviderConfig {
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
}

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

const OPENAI_MODELS: ModelInfo[] = [
  { id: "gpt-5-turbo", name: "GPT-5 Turbo", contextWindow: 200000, costPerMInput: 10, costPerMOutput: 30, capabilities: ["code", "debug", "doc", "test", "refactor", "complex-code"], quality: 95, speed: 90 },
  { id: "gpt-5", name: "GPT-5", contextWindow: 200000, costPerMInput: 15, costPerMOutput: 60, capabilities: ["complex-code", "arch", "review", "debug"], quality: 98, speed: 75 },
  { id: "gpt-4.1", name: "GPT-4.1", contextWindow: 1000000, costPerMInput: 2, costPerMOutput: 8, capabilities: ["code", "doc", "refactor", "test"], quality: 90, speed: 88 },
];

export class OpenAIProvider implements AIProvider {
  readonly id: string;
  readonly name: string;
  readonly models: ModelInfo[];

  protected apiKey: string;
  protected baseUrl: string;
  private timeout: number;
  private maxRetries: number;
  private defaultHeaders: Record<string, string>;

  // Health tracking
  private _latencyMs = 0;
  private _errorCount = 0;
  private _requestCount = 0;
  private _lastChecked = new Date();

  constructor(config: OpenAIProviderConfig = {}, overrides?: { id?: string; name?: string; models?: ModelInfo[] }) {
    this.id = overrides?.id ?? "openai";
    this.name = overrides?.name ?? "OpenAI";
    this.models = overrides?.models ?? OPENAI_MODELS;
    this.apiKey = config.apiKey ?? process.env["OPENAI_API_KEY"] ?? "";
    this.baseUrl = config.baseUrl ?? process.env["OPENAI_BASE_URL"] ?? DEFAULT_BASE_URL;
    this.timeout = config.timeout ?? 30000;
    this.maxRetries = config.maxRetries ?? 3;
    this.defaultHeaders = config.defaultHeaders ?? {};
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const body = this.buildRequestBody(options, false);
    const response = await this.fetchWithRetry("/chat/completions", body);
    const data = (await response.json()) as OpenAIChatResponse;

    const choice = data.choices?.[0];
    if (!choice) throw new Error("No choices in OpenAI response");

    return {
      id: data.id,
      provider: this.id,
      model: data.model,
      message: {
        role: "assistant",
        content: choice.message.content ?? "",
        toolCalls: choice.message.tool_calls?.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        })),
      },
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      finishReason: this.mapFinishReason(choice.finish_reason),
    };
  }

  async *chatStream(options: ChatOptions): AsyncIterable<StreamChunk> {
    const body = this.buildRequestBody(options, true);
    const response = await this.fetchWithRetry("/chat/completions", body);

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
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data: ")) continue;

        try {
          const json = JSON.parse(trimmed.slice(6)) as OpenAIStreamChunk;
          const delta = json.choices?.[0]?.delta;

          if (delta?.content) {
            yield { type: "text", text: delta.content };
          }
          if (delta?.tool_calls?.[0]) {
            yield {
              type: "tool_call",
              toolCall: {
                id: delta.tool_calls[0].id,
                name: delta.tool_calls[0].function?.name,
                arguments: delta.tool_calls[0].function?.arguments
                  ? JSON.parse(delta.tool_calls[0].function.arguments)
                  : undefined,
              },
            };
          }
          if (json.usage) {
            yield {
              type: "done",
              usage: {
                promptTokens: json.usage.prompt_tokens,
                completionTokens: json.usage.completion_tokens,
                totalTokens: json.usage.total_tokens,
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
    const errorRate = this._requestCount > 0
      ? this._errorCount / this._requestCount
      : 0;

    return {
      provider: this.id,
      status: errorRate > 0.5 ? "unavailable" : errorRate > 0.1 ? "degraded" : "healthy",
      latencyMs: this._latencyMs,
      lastChecked: this._lastChecked,
      errorRate,
    };
  }

  /**
   * Fetch latest models from the provider's /models endpoint.
   * Merges with static models: known models get updated contextWindow,
   * new models are added with sensible defaults.
   */
  async fetchRemoteModels(): Promise<ModelInfo[]> {
    try {
      const url = `${this.baseUrl}/models`;
      const headers: Record<string, string> = {};
      if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) return [...this.models];

      const data = (await response.json()) as { data?: Array<{ id: string }> };
      if (!data.data || !Array.isArray(data.data)) return [...this.models];

      const remoteIds = new Set(data.data.map((m) => m.id));
      const staticMap = new Map(this.models.map((m) => [m.id, m]));
      const merged: ModelInfo[] = [];

      // Update static models with remote data where available
      for (const model of this.models) {
        merged.push({ ...model });
      }

      // Add new models not in static list
      for (const remoteId of remoteIds) {
        if (staticMap.has(remoteId)) continue;
        merged.push({
          id: remoteId,
          name: remoteId,
          contextWindow: 128000,
          costPerMInput: 0,
          costPerMOutput: 0,
          capabilities: ["code", "debug", "doc"] as import("../index.js").TaskType[],
          quality: 75,
          speed: 80,
        });
      }

      return merged;
    } catch {
      return [...this.models];
    }
  }

  // ─── Private Methods ───

  private buildRequestBody(options: ChatOptions, stream: boolean): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: options.model,
      messages: options.messages.map((m) => this.mapMessage(m)),
      stream,
    };

    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    if (options.topP !== undefined) body.top_p = options.topP;
    if (options.frequencyPenalty !== undefined) body.frequency_penalty = options.frequencyPenalty;
    if (options.presencePenalty !== undefined) body.presence_penalty = options.presencePenalty;
    if (options.stop) body.stop = options.stop;

    if (options.tools?.length) {
      body.tools = options.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    return body;
  }

  private mapMessage(msg: Message): Record<string, unknown> {
    const mapped: Record<string, unknown> = {
      role: msg.role,
      content: msg.content,
    };
    if (msg.toolCalls) {
      mapped.tool_calls = msg.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      }));
    }
    if (msg.toolCallId) mapped.tool_call_id = msg.toolCallId;
    if (msg.name) mapped.name = msg.name;
    return mapped;
  }

  private mapFinishReason(reason: string | null | undefined): ChatResponse["finishReason"] {
    switch (reason) {
      case "stop": return "stop";
      case "tool_calls": return "tool_calls";
      case "length": return "length";
      default: return "error";
    }
  }

  private async fetchWithRetry(path: string, body: Record<string, unknown>): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.defaultHeaders,
    };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

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
          throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this._errorCount++;
        this._requestCount++;
        this._lastChecked = new Date();

        if (attempt < this.maxRetries) {
          await this.sleep(Math.min(1000 * 2 ** attempt, 10000));
        }
      }
    }
    throw lastError ?? new Error("OpenAI request failed");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─── OpenAI API Response Types ───

interface OpenAIChatResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamChunk {
  choices: Array<{
    delta: {
      content?: string;
      tool_calls?: Array<{
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
