// ─── xAI Provider (US) ───
import { GenericOpenAIProvider } from "./generic.js";
import type { ModelInfo, ProviderConfig } from "../index.js";

const MODELS: ModelInfo[] = [
  { id: "grok-3", name: "Grok 3", contextWindow: 131072, costPerMInput: 3.00, costPerMOutput: 15.00, capabilities: ["complex-code", "arch", "review", "code", "debug"], quality: 93, speed: 85 },
  { id: "grok-3-mini", name: "Grok 3 Mini", contextWindow: 131072, costPerMInput: 0.30, costPerMOutput: 0.50, capabilities: ["code", "debug", "doc", "simple"], quality: 80, speed: 95 },
];

export class XAIProvider extends GenericOpenAIProvider {
  constructor(config: ProviderConfig = {}) {
    super(config, { id: "xai", name: "xAI (Grok)", baseUrl: "https://api.x.ai/v1", models: MODELS });
  }
}
