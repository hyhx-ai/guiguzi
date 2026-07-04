// ─── DeepSeek Provider (China) ───
import { GenericOpenAIProvider } from "./generic.js";
import type { ModelInfo, ProviderConfig } from "../index.js";

const MODELS: ModelInfo[] = [
  { id: "deepseek-chat", name: "DeepSeek V3", contextWindow: 64000, costPerMInput: 0.27, costPerMOutput: 1.10, capabilities: ["code", "debug", "doc", "test", "refactor"], quality: 88, speed: 90 },
  { id: "deepseek-reasoner", name: "DeepSeek R1", contextWindow: 64000, costPerMInput: 0.55, costPerMOutput: 2.19, capabilities: ["complex-code", "arch", "review", "debug", "refactor"], quality: 94, speed: 60 },
];

export class DeepSeekProvider extends GenericOpenAIProvider {
  constructor(config: ProviderConfig = {}) {
    super(config, { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", models: MODELS });
  }
}
