// ─── MiniMax Provider (China) ───
import { GenericOpenAIProvider } from "./generic.js";
import type { ModelInfo, ProviderConfig } from "../index.js";

const MODELS: ModelInfo[] = [
  { id: "MiniMax-Text-01", name: "MiniMax Text 01", contextWindow: 1000000, costPerMInput: 0.20, costPerMOutput: 1.10, capabilities: ["complex-code", "arch", "review", "code", "debug"], quality: 86, speed: 85 },
  { id: "abab6.5s-chat", name: "ABAB 6.5s", contextWindow: 245000, costPerMInput: 0.10, costPerMOutput: 0.10, capabilities: ["code", "debug", "doc", "simple"], quality: 78, speed: 92 },
];

export class MiniMaxProvider extends GenericOpenAIProvider {
  constructor(config: ProviderConfig = {}) {
    super(config, { id: "minimax", name: "MiniMax", baseUrl: "https://api.minimax.chat/v1", models: MODELS });
  }
}
