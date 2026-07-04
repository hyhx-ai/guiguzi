// ─── Guiguzi Config Loader ───
// Reads ~/.guiguzi/guiguzi.json and applies provider settings to environment

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface GuiguziConfig {
  version?: string;
  provider?: string;
  model?: string;
  apiKey?: string;
  router?: {
    strategy?: string;
    weights?: Record<string, number>;
    fallback?: string;
  };
  gateway?: {
    port?: number;
    channels?: unknown[];
  };
  workspace?: string;
  daemon?: {
    installed?: boolean;
  };
}

const CONFIG_PATH = join(
  process.env.HOME ?? process.env.USERPROFILE ?? ".",
  ".guiguzi",
  "guiguzi.json",
);

export function loadConfig(): GuiguziConfig | null {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Apply config provider settings to environment variables
 * so that autoConfigureRegistry() picks them up.
 */
export function applyConfigToEnv(config: GuiguziConfig): void {
  if (!config.apiKey || !config.provider) return;

  // Don't override if env var already set (env takes precedence)
  const envMap: Record<string, string> = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    google: "GOOGLE_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    qwen: "QWEN_API_KEY",
    glm: "GLM_API_KEY",
    moonshot: "MOONSHOT_API_KEY",
    minimax: "MINIMAX_API_KEY",
    groq: "GROQ_API_KEY",
    together: "TOGETHER_API_KEY",
    xai: "XAI_API_KEY",
    custom: "OPENAI_API_KEY",
  };
  const envKey = envMap[config.provider];
  if (envKey && !process.env[envKey]) {
    process.env[envKey] = config.apiKey;
  }
}
