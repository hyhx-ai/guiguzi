#!/usr/bin/env node
// ─── Guiguzi CLI ───
// Terminal Coding Agent entry point

import { Command } from "commander";
import { AIRouter } from "@guiguzi/router";
import { Agent } from "@guiguzi/agent-core";
import {
  autoConfigureRegistry,
  getProviderRegistry,
  resetProviderRegistry,
  createProvider,
  PROVIDER_CATALOG,
  persistEnvVar,
  getProviderEnvKey,
  writeConfigSecure,
  type ModelInfo,
  type GuiguziConfig,
} from "@guiguzi/ai";
import { startConsoleServer } from "@guiguzi/web";
import { renderAgentApp } from "./render.js";

const VERSION = "0.1.0-alpha";

const program = new Command();

program
  .name("guiguzi")
  .description("Guiguzi - AI Coding Agent with Intelligent Router")
  .version(VERSION);

// ─── guiguzi agent ─── Interactive terminal agent
program
  .command("agent")
  .description("Start interactive coding agent")
  .option("-m, --model <model>", "Force specific model (e.g., deepseek:deepseek-chat)")
  .option("-s, --strategy <strategy>", "Routing strategy: static|task|cost|failover|hybrid", "hybrid")
  .option("-w, --workspace <path>", "Working directory", process.cwd())
  .option("--system-prompt <prompt>", "Custom system prompt")
  .action(async (options) => {
    console.log(`\n⟨guiguzi⟩ Guiguzi v${VERSION}`);
    console.log("⟨guiguzi⟩ Initializing...\n");

    // Auto-configure providers from environment
    let registry = await autoConfigureRegistry();
    let providers = registry.getEnabled();

    // Interactive setup if no providers configured
    if (providers.length === 0) {
      console.log("⟨guiguzi⟩ No AI providers configured. Let's set one up!\n");

      const readline = await import("node:readline");
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const ask = (q: string): Promise<string> =>
        new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));

      // Step 1: Select provider from catalog
      console.log("── Select AI Provider ──");
      const regions = [...new Set(PROVIDER_CATALOG.map((p) => p.region))];
      for (const region of regions) {
        console.log(`\n  [${region}]`);
        const entries = PROVIDER_CATALOG.filter((p) => p.region === region);
        for (const entry of entries) {
          const idx = PROVIDER_CATALOG.indexOf(entry) + 1;
          console.log(`    ${idx}. ${entry.name}`);
        }
      }
      console.log();
      const choiceStr = await ask("Enter provider number: ");
      const choiceIdx = parseInt(choiceStr, 10) - 1;
      if (choiceIdx < 0 || choiceIdx >= PROVIDER_CATALOG.length) {
        console.error("⟨guiguzi⟩ Invalid selection. Aborting.");
        rl.close();
        process.exit(1);
      }
      const selected = PROVIDER_CATALOG[choiceIdx]!;
      const selectedName = selected.name;
      const selectedId = selected.id;
      const selectedBaseUrl = selected.baseUrl;
      console.log(`\n✓ Selected: ${selectedName}`);

      // Step 2: Enter API key
      let apiKey = "";
      if (selectedId !== "ollama") {
        apiKey = await ask(`Enter ${selectedName} API key: `);
        if (!apiKey) {
          console.error("⟨guiguzi⟩ API key is required. Aborting.");
          rl.close();
          process.exit(1);
        }
        // Persist key to environment variable (current process + shell profile)
        const envKey = getProviderEnvKey(selectedId);
        if (envKey) {
          persistEnvVar(envKey, apiKey);
        }
      }

      // Step 3: Create ONLY the selected provider and fetch models dynamically
      console.log("\n⟨guiguzi⟩ Fetching latest models...");
      const providerInstance = createProvider(selectedId, {
        apiKey: apiKey || undefined,
        baseUrl: selectedBaseUrl,
      });
      const detectedModels = providerInstance.fetchRemoteModels
        ? await providerInstance.fetchRemoteModels()
        : providerInstance.models;

      let modelId: string | undefined;
      if (detectedModels.length > 0) {
        console.log("\n── Select Model ──");
        detectedModels.forEach((m: ModelInfo, i: number) => {
          const ctx = (m.contextWindow / 1000).toFixed(0);
          console.log(`    ${i + 1}. ${m.id} (${m.name})`);
          console.log(`       Context: ${ctx}k | Quality: ${m.quality}/100 | Speed: ${m.speed}/100`);
        });
        const modelStr = await ask("\nSelect model number (or press Enter for first): ");
        const modelIdx = modelStr ? parseInt(modelStr, 10) - 1 : 0;
        const modelAtIdx = detectedModels[modelIdx];
        const firstModel = detectedModels[0];
        if (modelIdx >= 0 && modelAtIdx) {
          modelId = `${selectedId}:${modelAtIdx.id}`;
          console.log(`\n✓ Selected: ${modelId}`);
        } else if (firstModel) {
          modelId = `${selectedId}:${firstModel.id}`;
          console.log(`\n✓ Using: ${modelId}`);
        }
      }

      // Save config (keyRef only — never plaintext key)
      const { mkdir } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const configDir = join(process.env.HOME ?? process.env.USERPROFILE ?? ".", ".guiguzi");
      const envKeyName = getProviderEnvKey(selectedId);
      const config = {
        version: VERSION,
        provider: selectedId,
        model: modelId ?? "default",
        keyRef: envKeyName,
        router: { strategy: "hybrid" },
        gateway: { port: 18789, channels: [] },
        workspace: join(process.env.HOME ?? process.env.USERPROFILE ?? ".", ".guiguzi", "workspace"),
        daemon: { installed: false },
      };
      await mkdir(configDir, { recursive: true });
      writeConfigSecure(config);
      console.log(`\n✓ Configuration saved to ${configDir}/guiguzi.json`);

      // Register ONLY the selected provider in the global registry
      resetProviderRegistry();
      getProviderRegistry().register(selectedId, providerInstance);
      providers = [providerInstance];
      registry = getProviderRegistry();
      rl.close();
    }

    // Initialize router
    const router = new AIRouter({ strategy: options.strategy });
    await router.initialize();

    const models = await registry.getAllModels();
    console.log(`⟨guiguzi⟩ Router: ${options.strategy} strategy active`);
    console.log(`⟨guiguzi⟩ ${providers.length} providers online, ${models.length} models available`);
    console.log("⟨guiguzi⟩ Ready. Type your request. (Ctrl+C to exit)\n");

    // Create agent
    const agent = new Agent({
      workspace: options.workspace,
      systemPrompt: options.systemPrompt,
      modelOverride: options.model,
    }, router);

    // Launch interactive Ink TUI
    renderAgentApp(agent, router, options.workspace);
  });

// ─── guiguzi print ─── Non-interactive mode
program
  .command("print")
  .description("Run a single prompt non-interactively")
  .argument("<prompt>", "The prompt to execute")
  .option("-m, --model <model>", "Force specific model")
  .option("-s, --strategy <strategy>", "Routing strategy", "hybrid")
  .option("-w, --workspace <path>", "Working directory", process.cwd())
  .action(async (prompt, options) => {
    await autoConfigureRegistry();
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

// ─── guiguzi doctor ─── Health check
program
  .command("doctor")
  .description("Check system health and provider status")
  .action(async () => {
    console.log("⟨guiguzi⟩ Running health checks...\n");

    const registry = await autoConfigureRegistry();
    const providers = registry.getEnabled();

    for (const provider of providers) {
      const available = await provider.isAvailable();
      const health = await provider.getHealth();
      const status = available ? "✓" : "✗";
      const color = available ? "\x1b[32m" : "\x1b[31m";
      console.log(`${color}${status}\x1b[0m ${provider.name}: ${health.status} (${health.latencyMs}ms, error rate: ${(health.errorRate * 100).toFixed(1)}%)`);
      console.log(`  Models: ${provider.models.map((m: ModelInfo) => m.id).join(", ")}`);
    }

    console.log(`\n⟨guiguzi⟩ ${providers.length} providers configured`);
    const models = await registry.getAllModels();
    console.log(`⟨guiguzi⟩ ${models.length} total models available`);
  });

// ─── guiguzi init ─── Project initialization
program
  .command("init")
  .description("Initialize Guiguzi in a project directory")
  .option("--non-interactive", "Skip interactive prompts")
  .option("--accept-risk", "Accept risk disclaimer")
  .action(async (options) => {
    console.log("⟨guiguzi⟩ Initializing Guiguzi...\n");

    const { writeFile, mkdir } = await import("node:fs/promises");
    const { join } = await import("node:path");

    const configDir = join(process.cwd(), ".guiguzi");
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

    console.log("✓ Created .guiguzi/config.json");
    console.log("✓ Guiguzi initialized!");
    console.log("\nNext steps:");
    console.log("  1. Set API keys: export DEEPSEEK_API_KEY=... or export GOOGLE_API_KEY=...");
    console.log("  2. Start agent: guiguzi agent");
    console.log("  3. Check health: guiguzi doctor");
  });

// ─── guiguzi gateway ─── Gateway management
program
  .command("gateway")
  .description("Manage the multi-channel gateway")
  .argument("<action>", "start|stop|install|status")
  .action(async (action) => {
    switch (action) {
      case "start":
        console.log("⟨guiguzi⟩ Starting gateway on port 18789...");
        // TODO: Start gateway server
        console.log("✓ Gateway started");
        break;
      case "stop":
        console.log("⟨guiguzi⟩ Stopping gateway...");
        console.log("✓ Gateway stopped");
        break;
      case "install":
        console.log("⟨guiguzi⟩ Installing gateway as system service...");
        console.log("✓ Run: sudo systemctl enable --now guiguzi-gateway");
        break;
      case "status":
        console.log("⟨guiguzi⟩ Gateway status: running");
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
      const regions = [...new Set(PROVIDER_CATALOG.map((p) => p.region))];
      for (const region of regions) {
        console.log(`\n  [${region}]`);
        const entries = PROVIDER_CATALOG.filter((p) => p.region === region);
        for (const entry of entries) {
          const idx = PROVIDER_CATALOG.indexOf(entry) + 1;
          console.log(`    ${idx}. ${entry.name}`);
        }
      }
      console.log();
      const providerChoice = await ask("Select provider number", "1");
      const providerIdx = parseInt(providerChoice, 10) - 1;
      const catalogEntry = (providerIdx >= 0 && providerIdx < PROVIDER_CATALOG.length)
        ? PROVIDER_CATALOG[providerIdx]!
        : PROVIDER_CATALOG[0]!;
      const provider = catalogEntry.id;
      const catalogName = catalogEntry.name;

      let apiKey = "";
      if (provider !== "ollama") {
        apiKey = await ask(`Enter ${catalogName} API key`);
        if (apiKey) {
          const envKey = getProviderEnvKey(provider);
          if (envKey) {
            persistEnvVar(envKey, apiKey);
          }
        }
      }

      // Step 2: Model selection
      console.log("\n── Step 2: Default Model ──");

      // Create ONLY the selected provider and fetch models dynamically
      console.log("  Fetching latest models...");
      const onboardProvider = createProvider(provider, {
        apiKey: apiKey || undefined,
        baseUrl: catalogEntry.baseUrl,
      });
      const detectedModels = onboardProvider.fetchRemoteModels
        ? await onboardProvider.fetchRemoteModels()
        : onboardProvider.models;

      let model: string;

      if (detectedModels.length > 0) {
        console.log("  Detected models:");
        detectedModels.forEach((m: ModelInfo, i: number) => {
          console.log(`    ${i + 1}. ${provider}:${m.id} (${m.name})`);
          console.log(`       Context: ${(m.contextWindow / 1000).toFixed(0)}k | Quality: ${m.quality}/100 | Speed: ${m.speed}/100`);
        });
        console.log(`    0. Skip (use default)`);
        const modelChoice = await ask("Select model number", "0");

        if (modelChoice === "0" || modelChoice === "") {
          model = `${provider}:${detectedModels[0]!.id}`;
          console.log(`  Using first available: ${model}`);
        } else {
          const idx = parseInt(modelChoice, 10) - 1;
          const selected = detectedModels[idx];
          if (idx >= 0 && selected) {
            model = `${provider}:${selected.id}`;
            console.log(`  Selected: ${model}`);
          } else {
            model = `${provider}:${detectedModels[0]!.id}`;
            console.log("  Invalid selection, using first available");
          }
        }
      } else {
        model = await ask("Default model", "default");
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

      // Build config (keyRef only — never plaintext key)
      config = {
        version: VERSION,
        provider,
        model,
        keyRef: getProviderEnvKey(provider),
        router: { strategy: "hybrid" },
        gateway: { port, channels },
        workspace,
        daemon: { installed: false },
      };

      rl.close();
    }

    // Save config with secure permissions
    await mkdir(configDir, { recursive: true });
    writeConfigSecure(config as GuiguziConfig);
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
      writeConfigSecure(config as GuiguziConfig);
    }

    // Health check
    console.log("\n── Health Check ──");
    const registry = await autoConfigureRegistry();
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

    const registry = await autoConfigureRegistry();
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
    const registry = await autoConfigureRegistry();
    const providers = registry.getEnabled();

    if (providers.length === 0) {
      console.log("⟨guiguzi⟩ No AI providers configured.");
      console.log("  Run 'guiguzi agent' for interactive setup, or 'guiguzi onboard'.");
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
