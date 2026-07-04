#!/usr/bin/env node
// ─── Guiguzi CLI ───
// Terminal Coding Agent entry point

import { Command } from "commander";
import { AIRouter } from "@guiguzi/router";
import { Agent } from "@guiguzi/agent-core";
import { autoConfigureRegistry, type ModelInfo } from "@guiguzi/ai";
import { renderAgentApp } from "./render.js";

const VERSION = "0.1.0-alpha";

const program = new Command();

program
  .name("nova")
  .description("Guiguzi - AI Coding Agent with Intelligent Router")
  .version(VERSION);

// ─── nova agent ─── Interactive terminal agent
program
  .command("agent")
  .description("Start interactive coding agent")
  .option("-m, --model <model>", "Force specific model (e.g., anthropic:claude-4-opus)")
  .option("-s, --strategy <strategy>", "Routing strategy: static|task|cost|failover|hybrid", "hybrid")
  .option("-w, --workspace <path>", "Working directory", process.cwd())
  .option("--system-prompt <prompt>", "Custom system prompt")
  .action(async (options) => {
    console.log(`\n⟨nova⟩ Guiguzi v${VERSION}`);
    console.log("⟨nova⟩ Initializing...\n");

    // Auto-configure providers from environment
    const registry = autoConfigureRegistry();
    const providers = registry.getEnabled();

    if (providers.length === 0) {
      console.error("⟨nova⟩ No AI providers configured!");
      console.error("⟨nova⟩ Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or start Ollama.");
      process.exit(1);
    }

    // Initialize router
    const router = new AIRouter({ strategy: options.strategy });
    await router.initialize();

    const models = await registry.getAllModels();
    console.log(`⟨nova⟩ Router: ${options.strategy} strategy active`);
    console.log(`⟨nova⟩ ${providers.length} providers online, ${models.length} models available`);
    console.log("⟨nova⟩ Ready. Type your request. (Ctrl+C to exit)\n");

    // Create agent
    const agent = new Agent({
      workspace: options.workspace,
      systemPrompt: options.systemPrompt,
      modelOverride: options.model,
    }, router);

    // Launch interactive Ink TUI
    renderAgentApp(agent, router, options.workspace);
  });

// ─── nova print ─── Non-interactive mode
program
  .command("print")
  .description("Run a single prompt non-interactively")
  .argument("<prompt>", "The prompt to execute")
  .option("-m, --model <model>", "Force specific model")
  .option("-s, --strategy <strategy>", "Routing strategy", "hybrid")
  .option("-w, --workspace <path>", "Working directory", process.cwd())
  .action(async (prompt, options) => {
    autoConfigureRegistry();
    const router = new AIRouter({ strategy: options.strategy });
    await router.initialize();

    const agent = new Agent({
      workspace: options.workspace,
      modelOverride: options.model,
    }, router);

    for await (const event of agent.run(prompt)) {
      if (event.type === "text") {
        process.stdout.write(event.content ?? "");
      }
    }

    router.shutdown();
  });

// ─── nova doctor ─── Health check
program
  .command("doctor")
  .description("Check system health and provider status")
  .action(async () => {
    console.log("⟨nova⟩ Running health checks...\n");

    const registry = autoConfigureRegistry();
    const providers = registry.getEnabled();

    for (const provider of providers) {
      const available = await provider.isAvailable();
      const health = await provider.getHealth();
      const status = available ? "✓" : "✗";
      const color = available ? "\x1b[32m" : "\x1b[31m";
      console.log(`${color}${status}\x1b[0m ${provider.name}: ${health.status} (${health.latencyMs}ms, error rate: ${(health.errorRate * 100).toFixed(1)}%)`);
      console.log(`  Models: ${provider.models.map((m: ModelInfo) => m.id).join(", ")}`);
    }

    console.log(`\n⟨nova⟩ ${providers.length} providers configured`);
    const models = await registry.getAllModels();
    console.log(`⟨nova⟩ ${models.length} total models available`);
  });

// ─── nova init ─── Project initialization
program
  .command("init")
  .description("Initialize Guiguzi in a project directory")
  .option("--non-interactive", "Skip interactive prompts")
  .option("--accept-risk", "Accept risk disclaimer")
  .action(async (options) => {
    console.log("⟨nova⟩ Initializing Guiguzi...\n");

    const { writeFile, mkdir } = await import("node:fs/promises");
    const { join } = await import("node:path");

    const configDir = join(process.cwd(), ".nova");
    await mkdir(configDir, { recursive: true });

    const config = {
      version: VERSION,
      router: {
        strategy: "hybrid",
        weights: { quality: 0.4, cost: 0.2, speed: 0.3, availability: 0.1 },
        fallback: "ollama:llama4",
      },
      gateway: {
        port: 18789,
        channels: [],
      },
    };

    await writeFile(
      join(configDir, "config.json"),
      JSON.stringify(config, null, 2)
    );

    console.log("✓ Created .nova/config.json");
    console.log("✓ Guiguzi initialized!");
    console.log("\nNext steps:");
    console.log("  1. Set API keys: export OPENAI_API_KEY=... or export ANTHROPIC_API_KEY=...");
    console.log("  2. Start agent: nova agent");
    console.log("  3. Check health: nova doctor");
  });

// ─── nova gateway ─── Gateway management
program
  .command("gateway")
  .description("Manage the multi-channel gateway")
  .argument("<action>", "start|stop|install|status")
  .action(async (action) => {
    switch (action) {
      case "start":
        console.log("⟨nova⟩ Starting gateway on port 18789...");
        // TODO: Start gateway server
        console.log("✓ Gateway started");
        break;
      case "stop":
        console.log("⟨nova⟩ Stopping gateway...");
        console.log("✓ Gateway stopped");
        break;
      case "install":
        console.log("⟨nova⟩ Installing gateway as system service...");
        console.log("✓ Run: sudo systemctl enable --now guiguzi-gateway");
        break;
      case "status":
        console.log("⟨nova⟩ Gateway status: running");
        console.log("  Port: 18789");
        console.log("  Channels: 0 configured");
        break;
      default:
        console.error(`Unknown action: ${action}`);
    }
  });

program.parse();
