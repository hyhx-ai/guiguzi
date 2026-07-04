// ─── Google Gemini Provider ───
// Uses Google's OpenAI-compatible endpoint
import { GenericOpenAIProvider } from "./generic.js";
import type { ModelInfo, ProviderConfig } from "../index.js";

const GOOGLE_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

const GOOGLE_MODELS: ModelInfo[] = [
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", contextWindow: 1000000, costPerMInput: 1.25, costPerMOutput: 10, capabilities: ["complex-code", "arch", "review", "code", "debug", "doc", "test", "refactor"], quality: 96, speed: 85 },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", contextWindow: 1000000, costPerMInput: 0.15, costPerMOutput: 0.60, capabilities: ["code", "debug", "doc", "test", "refactor"], quality: 88, speed: 95 },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", contextWindow: 1000000, costPerMInput: 0.075, costPerMOutput: 0.30, capabilities: ["code", "debug", "doc", "test", "simple", "autocomplete"], quality: 82, speed: 98 },
];

export class GoogleProvider extends GenericOpenAIProvider {
  constructor(config: ProviderConfig = {}) {
    super(config, { id: "google", name: "Google (Gemini)", baseUrl: GOOGLE_BASE_URL, models: GOOGLE_MODELS });
  }
}
