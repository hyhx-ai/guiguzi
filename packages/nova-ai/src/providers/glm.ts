// ─── GLM Provider (China - Zhipu AI) ───
import { GenericOpenAIProvider } from "./generic.js";
import type { ModelInfo, ProviderConfig } from "../index.js";

const MODELS: ModelInfo[] = [
  { id: "glm-4-plus", name: "GLM-4 Plus", contextWindow: 128000, costPerMInput: 7.14, costPerMOutput: 7.14, capabilities: ["complex-code", "arch", "review", "code", "debug"], quality: 90, speed: 82 },
  { id: "glm-4-flash", name: "GLM-4 Flash", contextWindow: 128000, costPerMInput: 0, costPerMOutput: 0, capabilities: ["code", "simple", "doc", "autocomplete"], quality: 75, speed: 95 },
];

export class GLMProvider extends GenericOpenAIProvider {
  constructor(config: ProviderConfig = {}) {
    super(config, { id: "glm", name: "GLM (Zhipu)", baseUrl: "https://open.bigmodel.cn/api/paas/v4", models: MODELS });
  }
}
