import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

export interface EditorProps {
  onSubmit: (text: string) => void;
  onAbort?: () => void;
  placeholder?: string;
}

export function Editor({ onSubmit, onAbort, placeholder = "Type a message..." }: EditorProps) {
  const [input, setInput] = useState("");

  useInput((char, key) => {
    if (key.return && input.trim()) {
      onSubmit(input.trim());
      setInput("");
    } else if (key.escape) {
      onAbort?.();
    } else if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
    } else if (char) {
      setInput((prev) => prev + char);
    }
  });

  return (
    <Box paddingX={1}>
      <Text color="#F6C453" bold>❯ </Text>
      {input.length === 0 ? (
        <Text dimColor italic>{placeholder}</Text>
      ) : (
        <Text>{input}</Text>
      )}
    </Box>
  );
}
