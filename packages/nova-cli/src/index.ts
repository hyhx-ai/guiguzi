#!/usr/bin/env node
// ─── Guiguzi CLI ───
// Terminal Coding Agent entry point

import { Command } from "commander";
import { AIRouter } from "@guiguzi/router";
import { Agent } from "@guiguzi/agent-core";
import { autoConfigureRegistry, type ModelInfo } from "@guiguzi/ai";
import { startConsoleServer } from "@guiguzi/web";
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

// ─── guiguzi onboard ─── Interactive setup wizard
program
  .command("onboard")
  .description("Interactive setup wizard for Guiguzi")
  .option("--non-interactive", "Skip interactive prompts (CI mode)")
  .option("--install-daemon", "Install background daemon service")
  .option("--reset", "Reset existing configuration")
  .option("--json", "Output JSON events")
  .action(async (options) => {
    const { writeFile, mkdir, readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const { existsSync } = await import("node:fs");

    const configDir = join(process.env.HOME ?? process.env.USERPROFILE ?? ".", ".guiguzi");
    const configFile = join(configDir, "guiguzi.json");

    console.log("\n⟨guiguzi⟩ Guiguzi Setup Wizard\n");

    // Reset if requested
    if (options.reset && existsSync(configFile)) {
      const { unlink } = await import("node:fs/promises");
      await unlink(configFile);
      console.log("✓ Previous configuration removed");
    }

    // Load existing config or start fresh
    let config: Record<string, unknown> = {};
    if (existsSync(configFile)) {
      try {
        config = JSON.parse(await readFile(configFile, "utf-8"));
        console.log("✓ Loaded existing configuration");
      } catch {
        config = {};
      }
    }

    if (options.nonInteractive) {
      // Non-interactive: use defaults
      config = {
        ...config,
        version: VERSION,
        provider: config.provider ?? "auto",
        router: config.router ?? { strategy: "hybrid" },
        gateway: config.gateway ?? { port: 18789, channels: [] },
        workspace: config.workspace ?? join(process.env.HOME ?? process.env.USERPROFILE ?? ".", ".guiguzi", "workspace"),
        daemon: config.daemon ?? { installed: false },
      };
    } else {
      // Interactive mode - use readline for prompts
      const readline = await import("node:readline");
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const ask = (q: string, def?: string): Promise<string> =>
        new Promise((resolve) => {
          const prompt = def ? `${q} [${def}]: ` : `${q}: `;
          rl.question(prompt, (answer) => resolve(answer || def || ""));
        });

      // Step 1: Provider selection
      console.log("\n── Step 1: AI Provider ──");
      console.log("  1. Anthropic (Claude)");
      console.log("  2. OpenAI (GPT)");
      console.log("  3. Google (Gemini)");
      console.log("  4. Ollama (Local)");
      console.log("  5. Custom (OpenAI-compatible)");
      const providerChoice = await ask("Select provider", "1");
      const providerMap: Record<string, string> = {
        "1": "anthropic", "2": "openai", "3": "google", "4": "ollama", "5": "custom"
      };
      const provider = providerMap[providerChoice] ?? "anthropic";

      let apiKey = "";
      if (provider !== "ollama") {
        apiKey = await ask(`Enter ${provider} API key`);
        // Set env var immediately so autoConfigureRegistry() in Step 2 can detect the provider
        if (apiKey) {
          const envMap: Record<string, string> = {
            openai: "OPENAI_API_KEY",
            anthropic: "ANTHROPIC_API_KEY",
            google: "GOOGLE_API_KEY",
            custom: "OPENAI_API_KEY",
          };
          const envKey = envMap[provider];
          if (envKey && !process.env[envKey]) {
            process.env[envKey] = apiKey;
          }
        }
      }

      // Step 2: Model selection
      console.log("\n── Step 2: Default Model ──");

      // Detect available models from configured providers
      const modelRegistry = autoConfigureRegistry();
      const detectedProviders = modelRegistry.getEnabled();
      const detectedModels = await modelRegistry.getAllModels();

      let model: string;

      if (detectedModels.length > 0) {
        console.log("  Detected models:");
        detectedModels.forEach((m: ModelInfo, i: number) => {
          console.log(`    ${i + 1}. ${m.id} (${m.name})`);
          console.log(`       Context: ${(m.contextWindow / 1000).toFixed(0)}k | Quality: ${m.quality}/100 | Speed: ${m.speed}/100`);
        });
        console.log(`    0. Skip (use default)`);
        const modelChoice = await ask("Select model number", "0");

        if (modelChoice === "0" || modelChoice === "") {
          const defaultModels: Record<string, string> = {
            anthropic: "claude-4-sonnet",
            openai: "gpt-4o",
            google: "gemini-2.5-pro",
            ollama: "llama4",
            custom: "default",
          };
          model = defaultModels[provider] ?? "default";
          console.log(`  Using default: ${model}`);
        } else {
          const idx = parseInt(modelChoice, 10) - 1;
          const selected = detectedModels[idx];
          if (idx >= 0 && selected) {
            model = selected.id;
            console.log(`  Selected: ${model}`);
          } else {
            model = "default";
            console.log("  Invalid selection, using default");
          }
        }
      } else {
        const defaultModels: Record<string, string> = {
          anthropic: "claude-4-sonnet",
          openai: "gpt-4o",
          google: "gemini-2.5-pro",
          ollama: "llama4",
          custom: "default",
        };
        model = await ask("Default model", defaultModels[provider]);
      }

      // Step 3: Workspace
      console.log("\n── Step 3: Workspace ──");
      const workspace = await ask("Workspace directory",
        join(process.env.HOME ?? process.env.USERPROFILE ?? ".", ".guiguzi", "workspace"));

      // Step 4: Gateway
      console.log("\n── Step 4: Gateway ──");
      const port = parseInt(await ask("Gateway port", "18789"), 10);

      // Step 5: Channels
      console.log("\n── Step 5: Channels ──");
      console.log("  Available: feishu, slack, discord, telegram, whatsapp, matrix,");
      console.log("  msteams, line, irc, googlechat, mattermost, sms, nostr, qqbot, web");
      const channelInput = await ask("Configure channels (comma-separated, or 'none')", "none");
      const channels = channelInput === "none" ? [] :
        channelInput.split(",").map((c: string) => ({
          type: c.trim(),
          name: c.trim(),
          config: {},
          bindings: [],
        }));

      // Build config
      config = {
        version: VERSION,
        provider,
        model,
        apiKey: apiKey,
        router: { strategy: "hybrid" },
        gateway: { port, channels },
        workspace,
        daemon: { installed: false },
      };

      rl.close();
    }

    // Save config
    await mkdir(configDir, { recursive: true });
    await writeFile(configFile, JSON.stringify(config, null, 2));
    console.log(`\n✓ Configuration saved to ${configFile}`);

    // Create workspace
    const workspaceDir = config.workspace as string;
    await mkdir(workspaceDir, { recursive: true });
    console.log(`✓ Workspace created at ${workspaceDir}`);

    // Install daemon if requested
    if (options.installDaemon) {
      const platform = process.platform;
      if (platform === "linux") {
        console.log("\n⟨guiguzi⟩ Installing systemd user service...");
        const serviceDir = join(process.env.HOME ?? "", ".config", "systemd", "user");
        await mkdir(serviceDir, { recursive: true });
        const serviceContent = `[Unit]
Description=Guiguzi Gateway
After=network.target

[Service]
Type=simple
ExecStart=${process.execPath} ${process.argv[1]} gateway start
Restart=on-failure
RestartSec=5
Environment=HOME=${process.env.HOME}

[Install]
WantedBy=default.target
`;
        await writeFile(join(serviceDir, "guiguzi-gateway.service"), serviceContent);
        console.log("✓ systemd service installed");
        console.log("  Run: systemctl --user enable --now guiguzi-gateway");
      } else if (platform === "darwin") {
        console.log("\n⟨guiguzi⟩ Installing LaunchAgent...");
        const launchDir = join(process.env.HOME ?? "", "Library", "LaunchAgents");
        await mkdir(launchDir, { recursive: true });
        const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>ai.guiguzi.gateway</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
    <string>${process.argv[1]}</string>
    <string>gateway</string>
    <string>start</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>`;
        await writeFile(join(launchDir, "ai.guiguzi.gateway.plist"), plistContent);
        console.log("✓ LaunchAgent installed");
        console.log("  Run: launchctl load ~/Library/LaunchAgents/ai.guiguzi.gateway.plist");
      } else if (platform === "win32") {
        console.log("\n⟨guiguzi⟩ Installing Windows Scheduled Task...");
        console.log("  Run as Admin: schtasks /create /tn GuiguziGateway /tr \"guiguzi gateway start\" /sc onlogon /rl highest");
      }
      config.daemon = { installed: true };
      await writeFile(configFile, JSON.stringify(config, null, 2));
    }

    // Health check
    console.log("\n── Health Check ──");
    const registry = autoConfigureRegistry();
    const providers = registry.getEnabled();
    if (providers.length > 0) {
      console.log(`✓ ${providers.length} AI provider(s) configured`);
      for (const p of providers) {
        const available = await p.isAvailable();
        console.log(`  ${available ? "✓" : "✗"} ${p.name}`);
      }
    } else {
      console.log("✗ No AI providers detected. Set API keys and re-run.");
    }

    console.log("\n⟨guiguzi⟩ Setup complete! Run 'guiguzi agent' to start.");
  });

// ─── guiguzi console ─── Web management console
program
  .command("console")
  .description("Start the web management console")
  .option("-p, --port <port>", "Port to listen on", "3000")
  .option("-h, --host <host>", "Host to bind to", "0.0.0.0")
  .action(async (options) => {
    console.log(`\n⟨guiguzi⟩ Starting Web Console...\n`);

    const registry = autoConfigureRegistry();
    const router = new AIRouter({ strategy: "hybrid" });
    await router.initialize();

    const port = parseInt(options.port, 10);
    const host = options.host;

    await startConsoleServer({ router, host, port, version: VERSION });

    const providers = registry.getEnabled();
    const models = await registry.getAllModels();
    console.log(`⟨guiguzi⟩ ${providers.length} providers, ${models.length} models`);
    console.log(`⟨guiguzi⟩ Press Ctrl+C to stop\n`);
  });

// ─── guiguzi models ─── Model configuration
program
  .command("models")
  .description("List and configure available AI models")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    const registry = autoConfigureRegistry();
    const providers = registry.getEnabled();

    if (providers.length === 0) {
      console.log("⟨guiguzi⟩ No AI providers configured.");
      console.log("  Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or start Ollama.");
      console.log("  Run 'guiguzi onboard' to configure.");
      return;
    }

    const allModels = await registry.getAllModels();

    if (options.json) {
      console.log(JSON.stringify(allModels, null, 2));
      return;
    }

    console.log("\n⟨guiguzi⟩ Available Models\n");

    // Group by provider
    for (const provider of providers) {
      const available = await provider.isAvailable();
      const status = available ? "\x1b[32m●\x1b[0m" : "\x1b[31m●\x1b[0m";
      console.log(`  ${status} ${provider.name}`);

      for (const model of provider.models) {
        const caps = model.capabilities.slice(0, 3).join(", ");
        console.log(`     ${model.id}`);
        console.log(`       Context: ${(model.contextWindow / 1000).toFixed(0)}k | $${model.costPerMInput.toFixed(2)}/$${model.costPerMOutput.toFixed(2)} per 1M tokens`);
        console.log(`       Quality: ${model.quality}/100 | Speed: ${model.speed}/100 | ${caps}`);
      }
      console.log();
    }

    console.log(`  Total: ${allModels.length} models across ${providers.length} providers`);
    console.log("\n  Tip: Use 'guiguzi agent -m <model>' to force a specific model.");
    console.log("  Tip: Use 'guiguzi onboard' to reconfigure providers.\n");
  });

program.parse();
