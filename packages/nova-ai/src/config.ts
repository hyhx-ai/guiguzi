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
  switch (config.provider) {
    case "openai":
      if (!process.env["OPENAI_API_KEY"]) {
        process.env["OPENAI_API_KEY"] = config.apiKey;
      }
      break;
    case "anthropic":
      if (!process.env["ANTHROPIC_API_KEY"]) {
        process.env["ANTHROPIC_API_KEY"] = config.apiKey;
      }
      break;
    case "google":
      if (!process.env["GOOGLE_API_KEY"]) {
        process.env["GOOGLE_API_KEY"] = config.apiKey;
      }
      break;
    case "custom":
      if (!process.env["OPENAI_API_KEY"]) {
        process.env["OPENAI_API_KEY"] = config.apiKey;
      }
      break;
    // ollama doesn't need an API key
  }
}
