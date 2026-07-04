import React from "react";
import { Box, Text } from "ink";

export interface FooterProps {
  host?: string;
  agent?: string;
  session?: string;
  model?: string;
  goal?: string;
  tokens?: { input: number; output: number };
  thinking?: boolean;
  fastMode?: boolean;
}

export function Footer({ host, agent, session, model, goal, tokens, thinking, fastMode }: FooterProps) {
  const parts: string[] = [];
  if (host) parts.push(host);
  if (agent) parts.push(`agent:${agent}`);
  if (session) parts.push(`session:${session.slice(0, 8)}`);
  if (model) parts.push(`model:${model}`);
  if (goal) parts.push(`goal:${goal}`);
  if (thinking) parts.push("thinking:on");
  if (fastMode) parts.push("fast:on");
  if (tokens) parts.push(`tok:${tokens.input + tokens.output}`);

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text dimColor>{parts.join(" | ") || "Ready"}</Text>
    </Box>
  );
}
