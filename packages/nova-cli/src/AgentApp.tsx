// ─── AgentApp ───
// Main Ink application component for the interactive terminal agent

import React, { useState, useCallback, useRef } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { Agent } from "@guiguzi/agent-core";
import type { AgentEvent } from "@guiguzi/agent-core";
import { AIRouter } from "@guiguzi/router";
import {
  ChatView,
  StatusBar,
  RouterPanel,
  DEFAULT_THEME,
} from "@guiguzi/tui";
import type { ChatMessage, ToolCall } from "@guiguzi/tui";
import type { ProviderHealth, RoutingDecision } from "@guiguzi/tui";

// ─── Props ───

export interface AgentAppProps {
  agent: Agent;
  router: AIRouter;
  workspace: string;
}

// ─── AgentApp Component ───

let msgCounter = 0;
function nextId(): string {
  return `msg-${++msgCounter}`;
}

export function AgentApp({ agent, router, workspace }: AgentAppProps) {
  const { exit } = useApp();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: nextId(),
      role: "system",
      content: `Guiguzi agent ready. Workspace: ${workspace}`,
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalTokens, setTotalTokens] = useState(0);
  const [lastProvider, setLastProvider] = useState("none");
  const [lastModel, setLastModel] = useState("none");
  const [statusMessage, setStatusMessage] = useState("");

  // Accumulate streaming text for the current assistant response
  const streamingRef = useRef<string>("");
  const streamingMsgIdRef = useRef<string | null>(null);
  const toolCallsRef = useRef<ToolCall[]>([]);

  const policy = router.getPolicy();

  // Build provider health list from the router's event log
  const providers: ProviderHealth[] = (() => {
    try {
      const log = router.getEventLog();
      const seen = new Map<string, ProviderHealth>();
      for (const entry of log) {
        if (entry.type === "decision" && entry.decision) {
          const pid = entry.decision.providerId;
          if (!seen.has(pid)) {
            seen.set(pid, { id: pid, status: "healthy" });
          }
        }
      }
      return seen.size > 0 ? Array.from(seen.values()) : [{ id: "waiting", status: "healthy" as const }];
    } catch {
      return [{ id: "init", status: "healthy" as const }];
    }
  })();

  // Build recent routing decisions
  const recentDecisions: RoutingDecision[] = (() => {
    try {
      return router
        .getEventLog()
        .filter((e) => e.type === "decision" && e.decision)
        .slice(-5)
        .map((e) => ({
          timestamp: e.timestamp,
          providerId: e.decision!.providerId,
          modelId: e.decision!.modelId,
          strategy: e.decision!.strategy,
          score: e.decision!.score,
          reason: e.decision!.reason,
        }));
    } catch {
      return [];
    }
  })();

  // ─── Send message to agent ───

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // Handle slash commands
      if (trimmed === "/quit" || trimmed === "/exit") {
        router.shutdown();
        exit();
        return;
      }

      if (trimmed === "/stats") {
        const stats = agent.getStats();
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "system" as const,
            content: `Conversation: ${stats.conversation.totalNodes} nodes, depth ${stats.conversation.depth} | Daily spend: $${stats.dailySpent.toFixed(4)}`,
          },
        ]);
        return;
      }

      // Add user message
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "user", content: trimmed },
      ]);

      // Prepare streaming assistant message
      const assistantId = nextId();
      streamingRef.current = "";
      streamingMsgIdRef.current = assistantId;
      toolCallsRef.current = [];
      setIsLoading(true);
      setStatusMessage("Sending...");

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      try {
        for await (const event of agent.run(trimmed)) {
          handleEvent(event, assistantId);
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: "system", content: `Error: ${errMsg}` },
        ]);
      } finally {
        setIsLoading(false);
        setStatusMessage("");
      }
    },
    [agent, router, exit]
  );

  // ─── Handle agent events ───

  const handleEvent = useCallback(
    (event: AgentEvent, assistantMsgId: string) => {
      switch (event.type) {
        case "thinking":
          setStatusMessage(
            `${event.provider}:${event.model} - thinking...`
          );
          if (event.provider) setLastProvider(event.provider);
          if (event.model) setLastModel(event.model);
          break;

        case "text":
          streamingRef.current += event.content ?? "";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: streamingRef.current }
                : m
            )
          );
          break;

        case "tool_call":
          if (event.toolCall) {
            const tc: ToolCall = {
              id: event.toolCall.id,
              name: event.toolCall.name,
              input: JSON.stringify(event.toolCall.arguments).slice(0, 120),
              status: "running",
            };
            toolCallsRef.current = [...toolCallsRef.current, tc];
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, toolCalls: [...toolCallsRef.current] }
                  : m
              )
            );
          }
          setStatusMessage(`Running tool: ${event.toolCall?.name ?? "unknown"}...`);
          break;

        case "tool_result":
          if (event.toolCall) {
            toolCallsRef.current = toolCallsRef.current.map((tc) =>
              tc.id === event.toolCall!.id
                ? {
                    ...tc,
                    output: event.toolResult
                      ? event.toolResult.content.slice(0, 200)
                      : "",
                    status: (event.toolResult?.isError
                      ? "failed"
                      : "completed") as ToolCall["status"],
                  }
                : tc
            );
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, toolCalls: [...toolCallsRef.current] }
                  : m
              )
            );
          }
          setStatusMessage("Processing result...");
          break;

        case "error":
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "system",
              content: `Error: ${event.error ?? "Unknown error"}`,
            },
          ]);
          break;

        case "done":
          if (event.usage) {
            setTotalTokens((prev) => prev + event.usage!.totalTokens);
          }
          setStatusMessage("");
          break;
      }
    },
    []
  );

  // ─── Input handling ───

  useInput((char, key) => {
    if (isLoading) {
      if (key.escape) {
        agent.abort();
        setIsLoading(false);
        setStatusMessage("Aborted.");
      }
      return;
    }

    if (key.return) {
      const text = input;
      setInput("");
      sendMessage(text);
      return;
    }

    if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
      return;
    }

    if (key.ctrl && char === "c") {
      router.shutdown();
      exit();
      return;
    }

    if (char) {
      setInput((prev) => prev + char);
    }
  });

  // ─── Render ───

  const strategy = policy.strategy ?? "hybrid";
  const dailySpend = `$${router.getDailySpent().toFixed(4)}`;

  return (
    <Box flexDirection="column" height="100%">
      {/* Top: Router Panel */}
      <RouterPanel
        currentStrategy={strategy}
        providers={providers}
        recentDecisions={recentDecisions}
        theme={DEFAULT_THEME}
      />

      {/* Middle: Chat View (flex-grow) */}
      <Box flexDirection="column" flexGrow={1} marginTop={1} marginBottom={1}>
        <ChatView
          messages={messages}
          isLoading={isLoading}
          theme={DEFAULT_THEME}
        />
      </Box>

      {/* Input line */}
      <Box flexDirection="row">
        <Text color={DEFAULT_THEME.primary} bold>{">"}</Text>
        <Text color={DEFAULT_THEME.text}> {input}</Text>
      </Box>

      {/* Status message */}
      {statusMessage && (
        <Box marginTop={0}>
          <Text color={DEFAULT_THEME.textDim}>{statusMessage}</Text>
        </Box>
      )}

      {/* Bottom: Status Bar */}
      <StatusBar
        provider={lastProvider}
        model={lastModel}
        strategy={strategy}
        tokenCount={totalTokens}
        dailySpend={dailySpend}
        theme={DEFAULT_THEME}
      />
    </Box>
  );
}
