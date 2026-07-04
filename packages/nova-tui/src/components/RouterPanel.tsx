import React from "react";
import { Box, Text } from "ink";
import { DEFAULT_THEME, formatHealthStatus } from "../index.js";
import type { Theme } from "../index.js";

// ─── Types ───

export interface ProviderHealth {
  id: string;
  status: "healthy" | "degraded" | "unavailable";
  latencyMs?: number;
}

export interface RoutingDecision {
  timestamp: Date;
  providerId: string;
  modelId: string;
  strategy: string;
  score: number;
  reason: string;
}

export interface RouterPanelProps {
  currentStrategy: string;
  providers: ProviderHealth[];
  recentDecisions?: RoutingDecision[];
  maxDecisions?: number;
  theme?: Theme;
}

// ─── Router Panel ───

export function RouterPanel({
  currentStrategy,
  providers,
  recentDecisions = [],
  maxDecisions = 5,
  theme = DEFAULT_THEME,
}: RouterPanelProps) {
  const visibleDecisions = recentDecisions.slice(-maxDecisions);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.secondary}
      paddingX={1}
    >
      {/* Header */}
      <Box>
        <Text color={theme.secondary} bold>
          Router
        </Text>
        <Text color={theme.textDim}> | Strategy: </Text>
        <Text color={theme.primary}>{currentStrategy}</Text>
      </Box>

      {/* Provider health */}
      <Box flexDirection="column" marginTop={1}>
        <Text color={theme.textDim} bold>
          Providers:
        </Text>
        {providers.map((p) => {
          const health = formatHealthStatus(p.status);
          const healthColor =
            p.status === "healthy"
              ? theme.success
              : p.status === "degraded"
                ? theme.warning
                : theme.error;

          return (
            <Box key={p.id} flexDirection="row" paddingLeft={2}>
              <Text color={theme.text}>{p.id}</Text>
              <Text color={theme.textDim}> | </Text>
              <Text color={healthColor}>{health}</Text>
              {p.latencyMs !== undefined && (
                <>
                  <Text color={theme.textDim}> | </Text>
                  <Text color={theme.textDim}>{p.latencyMs}ms</Text>
                </>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Recent routing decisions */}
      {visibleDecisions.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.textDim} bold>
            Recent decisions:
          </Text>
          {visibleDecisions.map((d, i) => (
            <Box key={i} flexDirection="row" paddingLeft={2}>
              <Text color={theme.accent}>[{d.strategy}]</Text>
              <Text color={theme.textDim}> </Text>
              <Text color={theme.text}>
                {d.providerId}:{d.modelId}
              </Text>
              <Text color={theme.textDim}> ({d.score.toFixed(1)})</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
