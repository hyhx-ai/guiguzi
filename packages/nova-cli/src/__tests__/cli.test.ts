import { describe, it, expect } from "vitest";

// CLI tests focus on the module structure and Commander configuration.
// We test the CLI by importing the built module and verifying Commander setup,
// since the actual CLI commands require AI providers.

describe("Guiguzi CLI", () => {
  it("should have the correct version string", async () => {
    // The version is embedded in the module; verify it via the built output
    const { execSync } = await import("node:child_process");
    const { join } = await import("node:path");
    const distPath = join(process.cwd(), "dist", "index.js");

    const output = execSync(`node "${distPath}" --version`, {
      encoding: "utf-8",
      timeout: 10000,
    }).trim();

    expect(output).toBe("0.1.0-alpha");
  });

  it("should display help text", async () => {
    const { execSync } = await import("node:child_process");
    const { join } = await import("node:path");
    const distPath = join(process.cwd(), "dist", "index.js");

    const output = execSync(`node "${distPath}" --help`, {
      encoding: "utf-8",
      timeout: 10000,
    });

    expect(output).toContain("Guiguzi");
    expect(output).toContain("AI Coding Agent");
    expect(output).toContain("Intelligent Router");
  });

  it("should list all commands in help", async () => {
    const { execSync } = await import("node:child_process");
    const { join } = await import("node:path");
    const distPath = join(process.cwd(), "dist", "index.js");

    const output = execSync(`node "${distPath}" --help`, {
      encoding: "utf-8",
      timeout: 10000,
    });

    // Verify all expected commands appear
    expect(output).toContain("agent");
    expect(output).toContain("print");
    expect(output).toContain("doctor");
    expect(output).toContain("init");
    expect(output).toContain("gateway");
  });

  it("should show agent command options", async () => {
    const { execSync } = await import("node:child_process");
    const { join } = await import("node:path");
    const distPath = join(process.cwd(), "dist", "index.js");

    const output = execSync(`node "${distPath}" agent --help`, {
      encoding: "utf-8",
      timeout: 10000,
    });

    expect(output).toContain("--model");
    expect(output).toContain("--strategy");
    expect(output).toContain("--workspace");
    expect(output).toContain("--system-prompt");
  });

  it("should show print command options", async () => {
    const { execSync } = await import("node:child_process");
    const { join } = await import("node:path");
    const distPath = join(process.cwd(), "dist", "index.js");

    const output = execSync(`node "${distPath}" print --help`, {
      encoding: "utf-8",
      timeout: 10000,
    });

    expect(output).toContain("--model");
    expect(output).toContain("--strategy");
  });

  it("should run doctor command", async () => {
    const { execSync } = await import("node:child_process");
    const { join } = await import("node:path");
    const distPath = join(process.cwd(), "dist", "index.js");

    const output = execSync(`node "${distPath}" doctor`, {
      encoding: "utf-8",
      timeout: 15000,
    });

    expect(output).toContain("health checks");
    expect(output).toContain("providers configured");
  });

  it("should show gateway subcommand help", async () => {
    const { execSync } = await import("node:child_process");
    const { join } = await import("node:path");
    const distPath = join(process.cwd(), "dist", "index.js");

    const output = execSync(`node "${distPath}" gateway --help`, {
      encoding: "utf-8",
      timeout: 10000,
    });

    expect(output).toContain("start");
    expect(output).toContain("stop");
    expect(output).toContain("install");
    expect(output).toContain("status");
  });
});
