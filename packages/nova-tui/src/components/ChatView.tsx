import React from "react";
import { Box, Text } from "ink";
import type { ThemePalette } from "../theme.js";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp?: Date;
  model?: string;
  toolCalls?: ToolCallDisplay[];
  isStreaming?: boolean;
}

export interface ToolCallDisplay {
  id: string;
  name: string;
  args: string;
  status: "running" | "success" | "error";
  output?: string;
  expanded?: boolean;
}

export interface ChatLogProps {
  messages: ChatMessage[];
  theme: ThemePalette;
  maxComponents?: number;
  toolsExpanded?: boolean;
}

export function ChatLog({ messages, theme, maxComponents = 180, toolsExpanded = false }: ChatLogProps) {
  const visible = messages.slice(-maxComponents);

  return (
    <Box flexDirection="column" paddingX={1}>
      {visible.map((msg) => {
        switch (msg.role) {
          case "user":
            return (
              <Box key={msg.id} flexDirection="column" marginBottom={1}>
                <Box>
                  <Text backgroundColor={theme.userBg} color={theme.userText} bold> You </Text>
                </Box>
                <Box paddingLeft={2}>
                  <Text wrap="wrap">{msg.content}</Text>
                </Box>
              </Box>
            );

          case "assistant":
            return (
              <Box key={msg.id} flexDirection="column" marginBottom={1}>
                <Box>
                  <Text color={theme.accent} bold>{"\u27E8guiguzi\u27E9"}</Text>
                  {msg.model && <Text dimColor> ({msg.model})</Text>}
                  {msg.isStreaming && <Text dimColor> ...</Text>}
                </Box>
                <Box paddingLeft={2}>
                  <Text wrap="wrap" color={theme.text}>{msg.content}</Text>
                </Box>
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <Box flexDirection="column" paddingLeft={2} marginTop={1}>
                    {msg.toolCalls.map((tc) => (
                      <ToolExecution key={tc.id} tool={tc} theme={theme} expanded={toolsExpanded} />
                    ))}
                  </Box>
                )}
              </Box>
            );

          case "system":
            return (
              <Box key={msg.id} marginBottom={1}>
                <Text color={theme.systemText} italic>{"\u2139"} {msg.content}</Text>
              </Box>
            );

          case "tool":
            return (
              <Box key={msg.id} marginBottom={1}>
                <Text dimColor>{"\uD83D\uDD27"} {msg.content}</Text>
              </Box>
            );

          default:
            return null;
        }
      })}
    </Box>
  );
}

function ToolExecution({ tool, theme, expanded }: { tool: ToolCallDisplay; theme: ThemePalette; expanded: boolean }) {
  const statusColor = tool.status === "running" ? theme.toolPending
    : tool.status === "success" ? theme.toolSuccess
    : theme.toolError;

  const statusIcon = tool.status === "running" ? "\u23F3"
    : tool.status === "success" ? "\u2713"
    : "\u2717";

  const outputLines = tool.output?.split("\n") ?? [];
  const previewLines = 12;
  const showFull = expanded || outputLines.length <= previewLines;
  const displayOutput = showFull ? outputLines : outputLines.slice(0, previewLines);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={statusColor}>{statusIcon} {tool.name}</Text>
        {tool.args && <Text dimColor> {tool.args}</Text>}
      </Box>
      {tool.output && (
        <Box flexDirection="column" paddingLeft={2} borderStyle="single" borderColor={theme.border}>
          {displayOutput.map((line, i) => (
            <Text key={i} dimColor>{line}</Text>
          ))}
          {!showFull && <Text dimColor>... ({outputLines.length - previewLines} more lines)</Text>}
        </Box>
      )}
    </Box>
  );
}

// Keep backward compat export
export { ChatLog as ChatView };

// ─── Backward compatibility types ───
// Legacy types for existing consumers (StatusBar, RouterPanel)

export interface ToolCall {
  id: string;
  name: string;
  input: string;
  output?: string;
  status: "running" | "completed" | "failed";
}

export interface ChatViewProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  maxHeight?: number;
}
