
export const API_VERSION = "10";
export const API_BASE = `https://discord.com/api/v${API_VERSION}`;

export const Endpoints = {
  gateway: () => `/gateway`,
  gatewayBot: () => `/gateway/bot`,

  user: (userId: string = "@me") => `/users/${userId}`,
  userMe: () => `/users/@me`,

  applicationCommands: (applicationId: string) =>
    `/applications/${applicationId}/commands`,
  applicationCommand: (applicationId: string, commandId: string) =>
    `/applications/${applicationId}/commands/${commandId}`,
  applicationGuildCommands: (applicationId: string, guildId: string) =>
    `/applications/${applicationId}/guilds/${guildId}/commands`,
  applicationGuildCommand: (applicationId: string, guildId: string, commandId: string) =>
    `/applications/${applicationId}/guilds/${guildId}/commands/${commandId}`,

  interactionCallback: (interactionId: string, token: string) =>
    `/interactions/${interactionId}/${token}/callback`,
  originalInteractionResponse: (applicationId: string, token: string) =>
    `/webhooks/${applicationId}/${token}/messages/@original`,
  followupMessage: (applicationId: string, token: string) =>
    `/webhooks/${applicationId}/${token}`,
  followupMessageSpecific: (applicationId: string, token: string, messageId: string) =>
    `/webhooks/${applicationId}/${token}/messages/${messageId}`,

  channel: (channelId: string) => `/channels/${channelId}`,
  channelMessages: (channelId: string) => `/channels/${channelId}/messages`,
  channelMessage: (channelId: string, messageId: string) =>
    `/channels/${channelId}/messages/${messageId}`,

  guild: (guildId: string) => `/guilds/${guildId}`,
  guildMember: (guildId: string, userId: string) =>
    `/guilds/${guildId}/members/${userId}`,
  guildBan: (guildId: string, userId: string) =>
    `/guilds/${guildId}/bans/${userId}`,
};
