import React from "react";
import { Box, Text } from "ink";

export interface StatusLineProps {
  busy: boolean;
  text?: string;
}

export function StatusLine({ busy, text }: StatusLineProps) {
  if (busy) {
    return (
      <Box paddingX={1}>
        <Text color="#F6C453">⟳ {text ?? "Thinking..."}</Text>
      </Box>
    );
  }
  return (
    <Box paddingX={1}>
      <Text dimColor>{text ?? "Ready"}</Text>
    </Box>
  );
}
