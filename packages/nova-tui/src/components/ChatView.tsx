import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { DEFAULT_THEME } from "../index.js";
import type { Theme } from "../index.js";

// ─── Types ───

export interface ToolCall {
  id: string;
  name: string;
  input: string;
  output?: string;
  status: "running" | "completed" | "failed";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCall[];
  timestamp?: Date;
}

export interface ChatViewProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  theme?: Theme;
  maxHeight?: number;
}

// ─── Tool Call Entry ───

interface ToolCallEntryProps {
  toolCall: ToolCall;
  theme: Theme;
}

function ToolCallEntry({ toolCall, theme }: ToolCallEntryProps) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon =
    toolCall.status === "running"
      ? "..."
      : toolCall.status === "completed"
        ? "+"
        : "!";

  const statusColor =
    toolCall.status === "running"
      ? theme.warning
      : toolCall.status === "completed"
        ? theme.success
        : theme.error;

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Box>
        <Text color={statusColor}>[{statusIcon}] </Text>
        <Text color={theme.accent}>{toolCall.name}</Text>
        <Text color={theme.textDim}>
          {expanded ? " (collapse)" : " (expand)"}
        </Text>
      </Box>
      {expanded && (
        <Box flexDirection="column" paddingLeft={2}>
          <Text color={theme.textDim}>Input: {toolCall.input}</Text>
          {toolCall.output && (
            <Text color={theme.textDim}>Output: {toolCall.output}</Text>
          )}
        </Box>
      )}
    </Box>
  );
}

// ─── Chat View ───

export function ChatView({
  messages,
  isLoading = false,
  theme = DEFAULT_THEME,
  maxHeight = 20,
}: ChatViewProps) {
  // Slice messages to fit within maxHeight (simple scroll simulation)
  const visibleMessages = messages.slice(-maxHeight);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.textDim} paddingX={1}>
      {visibleMessages.map((msg) => {
        if (msg.role === "user") {
          return (
            <Box key={msg.id} flexDirection="column">
              <Text color={theme.primary} bold>
                You: {msg.content}
              </Text>
            </Box>
          );
        }

        if (msg.role === "assistant") {
          return (
            <Box key={msg.id} flexDirection="column">
              <Text color={theme.text}>{msg.content}</Text>
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <Box flexDirection="column" marginTop={1}>
                  {msg.toolCalls.map((tc) => (
                    <ToolCallEntry key={tc.id} toolCall={tc} theme={theme} />
                  ))}
                </Box>
              )}
            </Box>
          );
        }

        // System messages
        return (
          <Box key={msg.id} flexDirection="column">
            <Text color={theme.textDim} italic>
              [system] {msg.content}
            </Text>
          </Box>
        );
      })}

      {isLoading && (
        <ThinkingIndicator theme={theme} />
      )}
    </Box>
  );
}

// ─── Thinking Indicator (animated dots) ───

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function ThinkingIndicator({ theme }: { theme: Theme }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box marginTop={1}>
      <Text color={theme.secondary}>{SPINNER_FRAMES[frame]} Thinking...</Text>
    </Box>
  );
}
