// ─── Moonshot Provider (China) ───
import { GenericOpenAIProvider } from "./generic.js";
import type { ModelInfo, ProviderConfig } from "../index.js";

const MODELS: ModelInfo[] = [
  { id: "moonshot-v1-128k", name: "Moonshot V1 128K", contextWindow: 128000, costPerMInput: 8.40, costPerMOutput: 8.40, capabilities: ["complex-code", "arch", "review", "code", "doc"], quality: 88, speed: 75 },
  { id: "moonshot-v1-32k", name: "Moonshot V1 32K", contextWindow: 32000, costPerMInput: 3.40, costPerMOutput: 3.40, capabilities: ["code", "debug", "doc", "refactor"], quality: 85, speed: 85 },
  { id: "moonshot-v1-8k", name: "Moonshot V1 8K", contextWindow: 8000, costPerMInput: 1.70, costPerMOutput: 1.70, capabilities: ["code", "simple", "doc", "autocomplete"], quality: 78, speed: 95 },
];

export class MoonshotProvider extends GenericOpenAIProvider {
  constructor(config: ProviderConfig = {}) {
    super(config, { id: "moonshot", name: "Moonshot", baseUrl: "https://api.moonshot.cn/v1", models: MODELS });
  }
}
