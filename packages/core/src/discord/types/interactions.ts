import type {
  DiscordMember,
  DiscordUser,
  DiscordMessage,
  DiscordChannel,
  DiscordEmbed,
  DiscordAllowedMentions,
} from "./entities.js";

export enum InteractionType {
  Ping = 1,
  ApplicationCommand = 2,
  MessageComponent = 3,
  ApplicationCommandAutocomplete = 4,
  ModalSubmit = 5,
}

export enum InteractionResponseType {
  Pong = 1,
  ChannelMessageWithSource = 4,
  DeferredChannelMessageWithSource = 5,
  DeferredUpdateMessage = 6,
  UpdateMessage = 7,
  ApplicationCommandAutocompleteResult = 8,
  Modal = 9,
}

export enum ApplicationCommandType {
  ChatInput = 1,
  User = 2,
  Message = 3,
}

export enum ApplicationCommandOptionType {
  Subcommand = 1,
  SubcommandGroup = 2,
  String = 3,
  Integer = 4,
  Boolean = 5,
  User = 6,
  Channel = 7,
  Role = 8,
  Mentionable = 9,
  Number = 10,
  Attachment = 11,
}

export enum ComponentType {
  ActionRow = 1,
  Button = 2,
  StringSelect = 3,
  TextInput = 4,
  UserSelect = 5,
  RoleSelect = 6,
  MentionableSelect = 7,
  ChannelSelect = 8,
}

export enum ButtonStyle {
  Primary = 1,
  Secondary = 2,
  Success = 3,
  Danger = 4,
  Link = 5,
  Premium = 6,
}

export enum TextInputStyle {
  Short = 1,
  Paragraph = 2,
}

export const MessageFlags = {
  Crossposted: 1 << 0,
  IsCrosspost: 1 << 1,
  SuppressEmbeds: 1 << 2,
  SourceMessageDeleted: 1 << 3,
  Urgent: 1 << 4,
  HasThread: 1 << 5,
  Ephemeral: 1 << 6,
  Loading: 1 << 7,
  FailedToMentionSomeRolesInThread: 1 << 8,
  SuppressNotifications: 1 << 12,
  IsVoiceMessage: 1 << 13,
} as const;

export interface DiscordSelectOption {
  label: string;
  value: string;
  description?: string;
  emoji?: { id?: string; name?: string; animated?: boolean };
  default?: boolean;
}

export interface DiscordComponent {
  type: ComponentType;
  custom_id?: string;
  disabled?: boolean;
  style?: ButtonStyle | TextInputStyle;
  label?: string;
  emoji?: { id?: string; name?: string; animated?: boolean };
  url?: string;
  options?: DiscordSelectOption[];
  placeholder?: string;
  min_values?: number;
  max_values?: number;
  min_length?: number;
  max_length?: number;
  required?: boolean;
  value?: string;
  components?: DiscordComponent[];
}

export interface DiscordInteractionDataOption {
  name: string;
  type: ApplicationCommandOptionType;
  value?: string | number | boolean;
  options?: DiscordInteractionDataOption[];
  focused?: boolean;
}

export interface DiscordInteractionData {
  id?: string;
  name?: string;
  type?: ApplicationCommandType;
  resolved?: {
    users?: Record<string, DiscordUser>;
    members?: Record<string, DiscordMember>;
    roles?: Record<string, any>;
    channels?: Record<string, any>;
    messages?: Record<string, DiscordMessage>;
    attachments?: Record<string, any>;
  };
  options?: DiscordInteractionDataOption[];
  guild_id?: string;
  target_id?: string;
  custom_id?: string;
  component_type?: ComponentType;
  values?: string[];
  components?: Array<{
    type: ComponentType;
    components: DiscordComponent[];
  }>;
}

export interface DiscordInteraction {
  id: string;
  application_id: string;
  type: InteractionType;
  data?: DiscordInteractionData;
  guild_id?: string;
  channel?: Partial<DiscordChannel>;
  channel_id?: string;
  member?: DiscordMember;
  user?: DiscordUser;
  token: string;
  version: number;
  message?: DiscordMessage;
  app_permissions?: string;
  locale?: string;
  guild_locale?: string;
}

export interface InteractionReplyOptions {
  content?: string;
  embeds?: DiscordEmbed[];
  components?: DiscordComponent[];
  ephemeral?: boolean;
  tts?: boolean;
  allowedMentions?: DiscordAllowedMentions;
}

export interface InteractionCallbackData {
  tts?: boolean;
  content?: string;
  embeds?: DiscordEmbed[];
  allowed_mentions?: DiscordAllowedMentions;
  flags?: number;
  components?: DiscordComponent[];
  choices?: Array<{ name: string; value: string | number }>;
  custom_id?: string;
  title?: string;
}
