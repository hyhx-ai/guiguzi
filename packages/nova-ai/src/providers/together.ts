// ─── Together Provider (US) ───
import { GenericOpenAIProvider } from "./generic.js";
import type { ModelInfo, ProviderConfig } from "../index.js";

const MODELS: ModelInfo[] = [
  { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", name: "Llama 3.3 70B Turbo", contextWindow: 128000, costPerMInput: 0.88, costPerMOutput: 0.88, capabilities: ["code", "debug", "doc", "refactor"], quality: 86, speed: 92 },
  { id: "Qwen/Qwen2.5-Coder-32B-Instruct", name: "Qwen 2.5 Coder 32B", contextWindow: 32000, costPerMInput: 0.80, costPerMOutput: 0.80, capabilities: ["code", "debug", "test", "refactor"], quality: 84, speed: 88 },
  { id: "deepseek-ai/DeepSeek-V3", name: "DeepSeek V3", contextWindow: 64000, costPerMInput: 0.27, costPerMOutput: 1.10, capabilities: ["code", "debug", "doc", "test"], quality: 88, speed: 85 },
];

export class TogetherProvider extends GenericOpenAIProvider {
  constructor(config: ProviderConfig = {}) {
    super(config, { id: "together", name: "Together AI", baseUrl: "https://api.together.xyz/v1", models: MODELS });
  }
}
