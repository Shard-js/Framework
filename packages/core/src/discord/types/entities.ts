
export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  global_name?: string | null;
  avatar: string | null;
  bot?: boolean;
  system?: boolean;
  mfa_enabled?: boolean;
  banner?: string | null;
  accent_color?: number | null;
  locale?: string;
  verified?: boolean;
  email?: string | null;
  flags?: number;
  premium_type?: number;
  public_flags?: number;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  icon?: string | null;
  unicode_emoji?: string | null;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
  tags?: {
    bot_id?: string;
    integration_id?: string;
    premium_subscriber?: null;
    subscription_listing_id?: string;
    available_for_purchase?: null;
    guild_connections?: null;
  };
  flags: number;
}

export interface DiscordMember {
  user?: DiscordUser;
  nick?: string | null;
  avatar?: string | null;
  banner?: string | null;
  roles: string[];
  joined_at: string;
  premium_since?: string | null;
  deaf: boolean;
  mute: boolean;
  flags: number;
  pending?: boolean;
  permissions?: string;
  communication_disabled_until?: string | null;
}

export enum ChannelType {
  GuildText = 0,
  DM = 1,
  GuildVoice = 2,
  GroupDM = 3,
  GuildCategory = 4,
  GuildAnnouncement = 5,
  AnnouncementThread = 10,
  PublicThread = 11,
  PrivateThread = 12,
  GuildStageVoice = 13,
  GuildDirectory = 14,
  GuildForum = 15,
  GuildMedia = 16,
}

export interface DiscordChannel {
  id: string;
  type: ChannelType;
  guild_id?: string;
  position?: number;
  name?: string | null;
  topic?: string | null;
  nsfw?: boolean;
  last_message_id?: string | null;
  bitrate?: number;
  user_limit?: number;
  rate_limit_per_user?: number;
  parent_id?: string | null;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  icon_hash?: string | null;
  splash: string | null;
  discovery_splash: string | null;
  owner_id: string;
  afk_channel_id: string | null;
  afk_timeout: number;
  widget_enabled?: boolean;
  widget_channel_id?: string | null;
  verification_level: number;
  default_message_notifications: number;
  explicit_content_filter: number;
  roles: DiscordRole[];
  emojis: any[];
  features: string[];
  mfa_level: number;
  application_id: string | null;
  system_channel_id: string | null;
  system_channel_flags: number;
  rules_channel_id: string | null;
  max_presences?: number | null;
  max_members?: number;
  vanity_url_code: string | null;
  description: string | null;
  banner: string | null;
  premium_tier: number;
  premium_subscription_count?: number;
  preferred_locale: string;
  public_updates_channel_id: string | null;
  max_video_channel_users?: number;
  max_stage_video_channel_users?: number;
  approximate_member_count?: number;
  approximate_presence_count?: number;
  nsfw_level: number;
  channels?: DiscordChannel[];
  members?: DiscordMember[];
}

export interface DiscordAttachment {
  id: string;
  filename: string;
  description?: string;
  content_type?: string;
  size: number;
  url: string;
  proxy_url: string;
  height?: number | null;
  width?: number | null;
  ephemeral?: boolean;
}

export interface DiscordEmbedFooter {
  text: string;
  icon_url?: string;
  proxy_icon_url?: string;
}

export interface DiscordEmbedImage {
  url: string;
  proxy_url?: string;
  height?: number;
  width?: number;
}

export interface DiscordEmbedThumbnail {
  url: string;
  proxy_url?: string;
  height?: number;
  width?: number;
}

export interface DiscordEmbedAuthor {
  name: string;
  url?: string;
  icon_url?: string;
  proxy_icon_url?: string;
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  type?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: DiscordEmbedFooter;
  image?: DiscordEmbedImage;
  thumbnail?: DiscordEmbedThumbnail;
  author?: DiscordEmbedAuthor;
  fields?: DiscordEmbedField[];
}

export interface DiscordAllowedMentions {
  parse?: Array<"roles" | "users" | "everyone">;
  roles?: string[];
  users?: string[];
  replied_user?: boolean;
}

export interface DiscordMessage {
  id: string;
  channel_id: string;
  author: DiscordUser;
  content: string;
  timestamp: string;
  edited_timestamp: string | null;
  tts: boolean;
  mention_everyone: boolean;
  mentions: DiscordUser[];
  mention_roles: string[];
  attachments: DiscordAttachment[];
  embeds: DiscordEmbed[];
  pinned: boolean;
  type: number;
  guild_id?: string;
  member?: DiscordMember;
}
