import React from "react";
import { Box, Text } from "ink";

export interface HeaderProps {
  version: string;
  model?: string;
  sessionId?: string;
}

export function Header({ version, model, sessionId }: HeaderProps) {
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text bold color="#F6C453">Guiguzi</Text>
      <Text dimColor> v{version}</Text>
      {model && <Text dimColor> | </Text>}
      {model && <Text color="cyan">{model}</Text>}
      {sessionId && <Text dimColor> | session: {sessionId.slice(0, 8)}</Text>}
    </Box>
  );
}
