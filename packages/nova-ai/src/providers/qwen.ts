// ─── Qwen / Tongyi Provider (China - Alibaba) ───
import { GenericOpenAIProvider } from "./generic.js";
import type { ModelInfo, ProviderConfig } from "../index.js";

const MODELS: ModelInfo[] = [
  { id: "qwen-max", name: "Qwen Max", contextWindow: 32000, costPerMInput: 2.00, costPerMOutput: 6.00, capabilities: ["complex-code", "arch", "review", "code", "debug"], quality: 92, speed: 80 },
  { id: "qwen-plus", name: "Qwen Plus", contextWindow: 131072, costPerMInput: 0.40, costPerMOutput: 1.20, capabilities: ["code", "debug", "doc", "test", "refactor"], quality: 85, speed: 90 },
  { id: "qwen-turbo", name: "Qwen Turbo", contextWindow: 131072, costPerMInput: 0.05, costPerMOutput: 0.20, capabilities: ["code", "simple", "doc", "autocomplete"], quality: 75, speed: 95 },
];

export class QwenProvider extends GenericOpenAIProvider {
  constructor(config: ProviderConfig = {}) {
    super(config, { id: "qwen", name: "Qwen (Tongyi)", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", models: MODELS });
  }
}
