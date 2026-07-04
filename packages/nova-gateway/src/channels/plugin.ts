import type { GatewayMessage } from "../index.js";

export type ChannelId =
  | "feishu" | "slack" | "discord" | "web" | "telegram" | "whatsapp"
  | "matrix" | "msteams" | "line" | "irc" | "googlechat" | "mattermost"
  | "sms" | "nostr" | "qqbot";

export interface ChannelMeta {
  id: ChannelId;
  label: string;
  description: string;
  docsUrl?: string;
}

export interface ChannelCapabilities {
  chatTypes: ("direct" | "group")[];
  media: boolean;
  threads: boolean;
  reactions: boolean;
}

export interface ChannelPlugin {
  id: ChannelId;
  meta: ChannelMeta;
  capabilities: ChannelCapabilities;
  parse: (body: unknown) => GatewayMessage | null;
  formatOutbound?: (text: string, target: { id: string; kind: "group" | "user" }) => unknown;
}

export function defineChannelPlugin(plugin: ChannelPlugin): ChannelPlugin {
  return plugin;
}
