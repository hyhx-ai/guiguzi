// Original channels
export { parseFeishuEvent } from "./feishu.js";
export { parseSlackEvent } from "./slack.js";
export { parseDiscordInteraction } from "./discord.js";
export { parseWebChat } from "./web.js";

// New channels
export { parseTelegramUpdate } from "./telegram.js";
export { parseWhatsAppMessage } from "./whatsapp.js";
export { parseMatrixEvent } from "./matrix.js";
export { parseMSTeamsActivity } from "./msteams.js";
export { parseLineWebhook } from "./line.js";
export { parseIrcMessage } from "./irc.js";
export { parseGoogleChatEvent } from "./googlechat.js";
export { parseMattermostEvent } from "./mattermost.js";
export { parseSmsWebhook } from "./sms.js";
export { parseNostrEvent } from "./nostr.js";
export { parseQQBotEvent } from "./qqbot.js";

// Plugin interface
export type {
  ChannelId,
  ChannelMeta,
  ChannelCapabilities,
  ChannelPlugin,
} from "./plugin.js";
export { defineChannelPlugin } from "./plugin.js";
