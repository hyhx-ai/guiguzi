// ─── Ollama Provider ───
// Local model provider - free, private, no API key needed

import type {
  AIProvider, ChatOptions, ChatResponse, StreamChunk,
  ProviderConfig, ProviderHealth, ModelInfo,
} from "../index.js";

const DEFAULT_BASE_URL = "http://localhost:11434";

const OLLAMA_MODELS: ModelInfo[] = [
  { id: "llama4", name: "Llama 4", contextWindow: 128000, costPerMInput: 0, costPerMOutput: 0, capabilities: ["code", "simple", "doc", "autocomplete", "debug"], quality: 72, speed: 45 },
  { id: "qwen3:8b", name: "Qwen3 8B", contextWindow: 32000, costPerMInput: 0, costPerMOutput: 0, capabilities: ["code", "simple", "autocomplete"], quality: 68, speed: 55 },
  { id: "deepseek-coder-v2", name: "DeepSeek Coder V2", contextWindow: 128000, costPerMInput: 0, costPerMOutput: 0, capabilities: ["code", "debug", "simple"], quality: 75, speed: 40 },
  { id: "codellama", name: "Code Llama", contextWindow: 16000, costPerMInput: 0, costPerMOutput: 0, capabilities: ["code", "simple", "autocomplete"], quality: 65, speed: 60 },
];

export class OllamaProvider implements AIProvider {
  readonly id = "ollama";
  readonly name = "Ollama (Local)";
  readonly models: ModelInfo[];

  private baseUrl: string;
  private timeout: number;
  private _availableModels: ModelInfo[] | null = null;

  private _latencyMs = 0;
  private _errorCount = 0;
  private _requestCount = 0;
  private _lastChecked = new Date();

  constructor(config: ProviderConfig = {}) {
    this.baseUrl = config.baseUrl ?? process.env["OLLAMA_BASE_URL"] ?? DEFAULT_BASE_URL;
    this.timeout = config.timeout ?? 120000; // Longer timeout for local models
    this.models = OLLAMA_MODELS;
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const body = {
      model: options.model,
      messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
      stream: false,
      options: {
        temperature: options.temperature,
        num_predict: options.maxTokens,
        top_p: options.topP,
      },
    };

    const start = Date.now();
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });

    this._latencyMs = Date.now() - start;
    this._requestCount++;
    this._lastChecked = new Date();

    if (!response.ok) {
      this._errorCount++;
      throw new Error(`Ollama error ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as OllamaChatResponse;

    return {
      id: `ollama-${Date.now()}`,
      provider: this.id,
      model: data.model,
      message: { role: "assistant", content: data.message.content },
      usage: {
        promptTokens: data.prompt_eval_count ?? 0,
        completionTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
      finishReason: data.done ? "stop" : "error",
    };
  }

  async *chatStream(options: ChatOptions): AsyncIterable<StreamChunk> {
    const body = {
      model: options.model,
      messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      options: {
        temperature: options.temperature,
        num_predict: options.maxTokens,
        top_p: options.topP,
      },
    };

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.body) throw new Error("No response body");
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
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line) as OllamaStreamChunk;
          if (json.message?.content) {
            yield { type: "text", text: json.message.content };
          }
          if (json.done) {
            yield {
              type: "done",
              usage: {
                promptTokens: json.prompt_eval_count ?? 0,
                completionTokens: json.eval_count ?? 0,
                totalTokens: (json.prompt_eval_count ?? 0) + (json.eval_count ?? 0),
              },
            };
          }
        } catch { /* skip */ }
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getHealth(): Promise<ProviderHealth> {
    const available = await this.isAvailable();
    const errorRate = this._requestCount > 0 ? this._errorCount / this._requestCount : 0;

    return {
      provider: this.id,
      status: available ? (errorRate > 0.1 ? "degraded" : "healthy") : "unavailable",
      latencyMs: this._latencyMs,
      lastChecked: this._lastChecked,
      errorRate,
    };
  }

  /** Fetch locally-installed models from Ollama's /api/tags endpoint. */
  async fetchRemoteModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return [...this.models];

      const data = (await response.json()) as {
        models?: Array<{ name: string; details?: { family?: string; parameter_size?: string } }>;
      };
      if (!data.models || !Array.isArray(data.models)) return [...this.models];

      const staticMap = new Map(this.models.map((m) => [m.id, m]));
      const merged: ModelInfo[] = [];

      for (const model of this.models) {
        merged.push({ ...model });
      }

      for (const remote of data.models) {
        const id = remote.name;
        if (staticMap.has(id)) continue;
        merged.push({
          id,
          name: id,
          contextWindow: 32000,
          costPerMInput: 0,
          costPerMOutput: 0,
          capabilities: ["code", "debug", "doc"] as import("../index.js").TaskType[],
          quality: 70,
          speed: 50,
        });
      }

      return merged;
    } catch {
      return [...this.models];
    }
  }
}

// ─── Ollama API Types ───

interface OllamaChatResponse {
  model: string;
  message: { role: string; content: string };
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaStreamChunk {
  message?: { role: string; content: string };
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}
