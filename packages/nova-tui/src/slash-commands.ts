export interface SlashCommand {
  name: string;
  description: string;
  aliases?: string[];
  execute: (args: string[], ctx: CommandContext) => Promise<string | void>;
}

export interface CommandContext {
  setModel?: (model: string) => void;
  setStrategy?: (strategy: string) => void;
  toggleThinking?: () => void;
  toggleFast?: () => void;
  toggleVerbose?: () => void;
  getSessionId?: () => string;
  getModel?: () => string;
  getTokens?: () => { input: number; output: number };
  abort?: () => void;
  exit?: () => void;
  newSession?: () => void;
  resetSession?: () => void;
}

export const slashCommands: SlashCommand[] = [
  {
    name: "/help",
    description: "Show available commands",
    execute: async () => {
      const cmds = slashCommands.map((c) => `  ${c.name.padEnd(20)} ${c.description}`).join("\n");
      return `Available commands:\n${cmds}`;
    },
  },
  {
    name: "/model",
    description: "Switch model (e.g., /model anthropic:claude-4-sonnet)",
    execute: async (args, ctx) => {
      if (args.length === 0) return `Current model: ${ctx.getModel?.() ?? "auto"}`;
      const model = args[0]!;
      ctx.setModel?.(model);
      return `Switched to model: ${model}`;
    },
  },
  {
    name: "/think",
    description: "Toggle thinking mode",
    execute: async (_args, ctx) => {
      ctx.toggleThinking?.();
      return "Thinking mode toggled";
    },
  },
  {
    name: "/fast",
    description: "Toggle fast mode",
    execute: async (_args, ctx) => {
      ctx.toggleFast?.();
      return "Fast mode toggled";
    },
  },
  {
    name: "/verbose",
    description: "Toggle verbose output",
    execute: async (_args, ctx) => {
      ctx.toggleVerbose?.();
      return "Verbose mode toggled";
    },
  },
  {
    name: "/usage",
    description: "Show token usage stats",
    execute: async (_args, ctx) => {
      const tokens = ctx.getTokens?.();
      if (!tokens) return "No token stats available";
      return `Tokens — input: ${tokens.input}, output: ${tokens.output}, total: ${tokens.input + tokens.output}`;
    },
  },
  {
    name: "/abort",
    description: "Abort current operation",
    execute: async (_args, ctx) => {
      ctx.abort?.();
      return "Aborted";
    },
  },
  {
    name: "/new",
    description: "Start a new session",
    execute: async (_args, ctx) => {
      ctx.newSession?.();
      return "New session started";
    },
  },
  {
    name: "/reset",
    description: "Reset current session",
    execute: async (_args, ctx) => {
      ctx.resetSession?.();
      return "Session reset";
    },
  },
  {
    name: "/exit",
    aliases: ["/quit"],
    description: "Exit the TUI",
    execute: async (_args, ctx) => {
      ctx.exit?.();
    },
  },
];

export function parseSlashCommand(input: string): { command: string; args: string[] } | null {
  if (!input.startsWith("/")) return null;
  const parts = input.slice(1).split(/\s+/);
  return { command: "/" + parts[0], args: parts.slice(1) };
}

export async function executeCommand(
  input: string,
  ctx: CommandContext
): Promise<{ handled: boolean; output?: string }> {
  const parsed = parseSlashCommand(input);
  if (!parsed) return { handled: false };

  const cmd = slashCommands.find(
    (c) => c.name === parsed.command || c.aliases?.includes(parsed.command)
  );
  if (!cmd) return { handled: true, output: `Unknown command: ${parsed.command}. Try /help` };

  const output = await cmd.execute(parsed.args, ctx);
  return { handled: true, output: output ?? undefined };
}
