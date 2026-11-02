import {
  InteractionResponseType,
  type DiscordInteraction,
} from "../types/interactions.js";
import type { DiscordUser, DiscordMember } from "../types/entities.js";
import type { RestClient } from "../rest/RestClient.js";
import { Endpoints } from "../rest/Endpoints.js";

export class AutocompleteInteraction {
  public raw: DiscordInteraction;
  public id: string;
  public applicationId: string;
  public token: string;
  public commandName: string;
  public user: DiscordUser;
  public member?: DiscordMember;
  public guildId?: string;
  public channelId?: string;

  public locale?: string;
  public guildLocale?: string;

  public responded = false;
  private rest: RestClient;

  constructor(interaction: DiscordInteraction, rest: RestClient) {
    this.raw = interaction;
    this.id = interaction.id;
    this.applicationId = interaction.application_id;
    this.token = interaction.token;
    this.commandName = interaction.data?.name || "";
    this.user = interaction.user || interaction.member?.user!;
    this.member = interaction.member;
    this.guildId = interaction.guild_id;
    this.channelId = interaction.channel_id;
    this.locale = interaction.locale;
    this.guildLocale = interaction.guild_locale;
    this.rest = rest;
  }

  public isAutocomplete(): this is AutocompleteInteraction {
    return true;
  }

  public isChatInputCommand(): boolean {
    return false;
  }

  public getSubcommand(): string | null {
    const opts = this.raw.data?.options || [];
    const group = opts.find((o: any) => o.type === 2);
    const searchIn = group ? group.options || [] : opts;
    const sub = searchIn.find((o: any) => o.type === 1);
    return sub?.name || null;
  }

  public getSubcommandGroup(): string | null {
    const opts = this.raw.data?.options || [];
    const group = opts.find((o: any) => o.type === 2);
    return group?.name || null;
  }

  public getFocusedOption(): { name: string; value: string | number; type: number } | null {
    const findFocused = (opts: any[]): any => {
      for (const opt of opts) {
        if (opt.focused) return opt;
        if (opt.options) {
          const nested = findFocused(opt.options);
          if (nested) return nested;
        }
      }
      return null;
    };

    return findFocused(this.raw.data?.options || []);
  }

  public async respond(choices: Array<{ name: string; value: string | number } | string>): Promise<void> {
    if (this.responded) return;

    const normalized = choices.map((c) =>
      typeof c === "string" ? { name: c, value: c } : c
    );

    await this.rest.post(Endpoints.interactionCallback(this.id, this.token), {
      body: {
        type: InteractionResponseType.ApplicationCommandAutocompleteResult,
        data: {
          choices: normalized.slice(0, 25), // Discord max 25 choices
        },
      },
      auth: false,
    });

    this.responded = true;
  }
}

export function filterChoices<T extends { name: string; value: string | number } | string>(
  query: string | number,
  choices: T[],
  limit = 25
): Array<{ name: string; value: string | number }> {
  const q = String(query).toLowerCase().trim();
  const normalized: Array<{ name: string; value: string | number }> = choices.map((c) =>
    typeof c === "string" ? { name: c, value: c } : (c as { name: string; value: string | number })
  );

  if (!q) {
    return normalized.slice(0, limit);
  }

  return normalized
    .filter((c) => c.name.toLowerCase().includes(q) || String(c.value).toLowerCase().includes(q))
    .slice(0, limit);
}
