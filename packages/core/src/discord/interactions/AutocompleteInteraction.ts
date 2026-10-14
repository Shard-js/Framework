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
    this.rest = rest;
  }

  public isAutocomplete(): this is AutocompleteInteraction {
    return true;
  }

  public isChatInputCommand(): boolean {
    return false;
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

  public async respond(choices: Array<{ name: string; value: string | number }>): Promise<void> {
    if (this.responded) return;

    await this.rest.post(Endpoints.interactionCallback(this.id, this.token), {
      body: {
        type: InteractionResponseType.ApplicationCommandAutocompleteResult,
        data: {
          choices: choices.slice(0, 25), // Discord max 25 choices
        },
      },
      auth: false,
    });

    this.responded = true;
  }
}
