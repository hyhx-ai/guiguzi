// ─── Guiguzi Config Loader ───
// Reads ~/.guiguzi/guiguzi.json and applies provider settings to environment
// API keys are NEVER stored in plaintext — keyRef points to env var names

import { readFileSync, writeFileSync, appendFileSync, chmodSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface GuiguziConfig {
  version?: string;
  provider?: string;
  model?: string;
  /** Reference to environment variable name holding the API key (never plaintext) */
  keyRef?: string;
  /** @deprecated migrated to keyRef on load */
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

/** Provider ID → environment variable name */
const PROVIDER_ENV_MAP: Record<string, string> = {
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

/** Get the environment variable name for a provider */
export function getProviderEnvKey(providerId: string): string | undefined {
  return PROVIDER_ENV_MAP[providerId];
}

/**
 * Persist an API key to the shell environment so it survives across sessions.
 * Linux/macOS: appends export line to ~/.bashrc and/or ~/.zshrc
 * Windows: uses setx to set user-level environment variable
 */
export function persistEnvVar(name: string, value: string): void {
  // Set in current process immediately
  process.env[name] = value;

  if (process.platform === "win32") {
    try {
      const { execSync } = require("node:child_process");
      execSync(`setx ${name} "${value}"`, { stdio: "ignore", windowsHide: true });
    } catch { /* silent */ }
    return;
  }

  // Unix: append to shell rc files
  const home = process.env.HOME ?? "";
  if (!home) return;

  const line = `export ${name}="${value}"\n`;

  for (const rcFile of [".bashrc", ".zshrc"]) {
    const rcPath = join(home, rcFile);
    try {
      if (existsSync(rcPath)) {
        const existing = readFileSync(rcPath, "utf-8");
        // Skip if this exact export already exists
        if (existing.includes(`export ${name}=`)) continue;
      }
      appendFileSync(rcPath, line);
    } catch { /* silent */ }
  }
}

/**
 * Migrate legacy config: convert plaintext apiKey → keyRef + env var persistence.
 * Returns the migrated config (mutates input). Also hardens file permissions.
 */
export function migrateConfig(config: GuiguziConfig): GuiguziConfig {
  if (config.apiKey && config.provider && !config.keyRef) {
    const envKey = PROVIDER_ENV_MAP[config.provider];
    if (envKey) {
      persistEnvVar(envKey, config.apiKey);
      config.keyRef = envKey;
    }
    delete config.apiKey;

    // Write migrated config back with secure permissions
    try {
      writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      if (process.platform !== "win32") {
        chmodSync(CONFIG_PATH, 0o600);
      }
    } catch { /* silent */ }
  }
  return config;
}

export function loadConfig(): GuiguziConfig | null {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    return migrateConfig(raw);
  } catch {
    return null;
  }
}

/**
 * Resolve API key from keyRef (environment variable).
 * Env vars already set by the OS take precedence.
 */
export function resolveApiKey(config: GuiguziConfig): string | undefined {
  if (config.keyRef) return process.env[config.keyRef];
  return undefined;
}

/**
 * Apply config provider settings to environment variables
 * so that autoConfigureRegistry() picks them up.
 * Reads the actual key from the env var pointed to by keyRef.
 */
export function applyConfigToEnv(config: GuiguziConfig): void {
  if (!config.keyRef || !config.provider) return;

  const envKey = PROVIDER_ENV_MAP[config.provider];
  if (envKey && !process.env[envKey]) {
    const key = process.env[config.keyRef];
    if (key) process.env[envKey] = key;
  }
}

/**
 * Write config file with secure permissions (0o600 on Unix).
 */
export function writeConfigSecure(config: GuiguziConfig): void {
  const dir = join(
    process.env.HOME ?? process.env.USERPROFILE ?? ".",
    ".guiguzi",
  );
  const filePath = join(dir, "guiguzi.json");
  writeFileSync(filePath, JSON.stringify(config, null, 2));
  if (process.platform !== "win32") {
    try { chmodSync(filePath, 0o600); } catch { /* silent */ }
  }
}
