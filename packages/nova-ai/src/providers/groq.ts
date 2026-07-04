// ─── Groq Provider (US) ───
import { GenericOpenAIProvider } from "./generic.js";
import type { ModelInfo, ProviderConfig } from "../index.js";

const MODELS: ModelInfo[] = [
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", contextWindow: 128000, costPerMInput: 0.0, costPerMOutput: 0.0, capabilities: ["code", "debug", "doc", "refactor"], quality: 85, speed: 98 },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", contextWindow: 128000, costPerMInput: 0.0, costPerMOutput: 0.0, capabilities: ["code", "simple", "autocomplete"], quality: 72, speed: 99 },
  { id: "gemma2-9b-it", name: "Gemma 2 9B", contextWindow: 8192, costPerMInput: 0.0, costPerMOutput: 0.0, capabilities: ["code", "simple", "doc"], quality: 70, speed: 98 },
];

export class GroqProvider extends GenericOpenAIProvider {
  constructor(config: ProviderConfig = {}) {
    super(config, { id: "groq", name: "Groq", baseUrl: "https://api.groq.com/openai/v1", models: MODELS });
  }
}
