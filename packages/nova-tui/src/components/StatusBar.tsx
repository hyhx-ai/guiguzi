import React from "react";
import { Box, Text } from "ink";
import { DEFAULT_THEME } from "../index.js";
import type { Theme } from "../index.js";

// ─── Types ───

export interface StatusBarProps {
  provider?: string;
  model?: string;
  strategy?: string;
  tokenCount?: number;
  dailySpend?: string;
  theme?: Theme;
}

// ─── Status Bar ───

export function StatusBar({
  provider = "none",
  model = "none",
  strategy = "static",
  tokenCount = 0,
  dailySpend = "$0.00",
  theme = DEFAULT_THEME,
}: StatusBarProps) {
  const formattedTokens =
    tokenCount >= 1000
      ? `${(tokenCount / 1000).toFixed(1)}k`
      : String(tokenCount);

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      borderStyle="single"
      borderColor={theme.textDim}
      paddingX={1}
    >
      <Box flexDirection="row">
        <Text color={theme.secondary}>{strategy}</Text>
        <Text color={theme.textDim}> | </Text>
        <Text color={theme.primary}>{provider}</Text>
        <Text color={theme.textDim}>:</Text>
        <Text color={theme.text}>{model}</Text>
      </Box>

      <Box flexDirection="row">
        <Text color={theme.textDim}>Tokens: </Text>
        <Text color={theme.accent}>{formattedTokens}</Text>
        <Text color={theme.textDim}> | Spend: </Text>
        <Text color={theme.success}>{dailySpend}</Text>
      </Box>
    </Box>
  );
}
