// ─── Generic OpenAI-Compatible Provider ───
// Base class for any OpenAI-compatible API (DeepSeek, Qwen, Groq, Together, etc.)
// Specific providers extend this with their own defaults.

import { OpenAIProvider, type OpenAIProviderConfig } from "./openai.js";
import type { ModelInfo } from "../index.js";

export class GenericOpenAIProvider extends OpenAIProvider {
  constructor(
    config: OpenAIProviderConfig,
    defaults: { id: string; name: string; baseUrl: string; models: ModelInfo[] },
  ) {
    super({
      ...config,
      apiKey: config.apiKey ?? "",
      baseUrl: config.baseUrl ?? defaults.baseUrl,
    }, {
      id: defaults.id,
      name: defaults.name,
      models: defaults.models,
    });
  }
}
