import type {
  CommandDefinition,
  CommandOptionDefinition,
  CommandOptionChoice,
  CommandOptionType,
} from "../../types/index.js";
import { ApplicationCommandType } from "../types/interactions.js";
import type { PermissionResolvable } from "../types/permissions.js";

export class SlashCommandOptionBase {
  public type: CommandOptionType;
  public name = "";
  public description = "";
  public required = false;

  constructor(type: CommandOptionType) {
    this.type = type;
  }

  public setName(name: string): this {
    this.name = name.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    return this;
  }

  public setDescription(description: string): this {
    this.description = description;
    return this;
  }

  public setRequired(required = true): this {
    this.required = required;
    return this;
  }

  public toJSON(): CommandOptionDefinition {
    return {
      type: this.type,
      name: this.name,
      description: this.description,
      required: this.required,
    };
  }
}

export class SlashCommandStringOption extends SlashCommandOptionBase {
  public choices?: CommandOptionChoice<string>[];
  public autocomplete = false;
  public minLength?: number;
  public maxLength?: number;

  constructor() {
    super("String");
  }

  public setAutocomplete(autocomplete = true): this {
    this.autocomplete = autocomplete;
    return this;
  }

  public setMinLength(min: number): this {
    this.minLength = min;
    return this;
  }

  public setMaxLength(max: number): this {
    this.maxLength = max;
    return this;
  }

  public addChoices(...choices: CommandOptionChoice<string>[]): this {
    if (!this.choices) this.choices = [];
    this.choices.push(...choices);
    return this;
  }

  public setChoices(...choices: CommandOptionChoice<string>[]): this {
    this.choices = [...choices];
    return this;
  }

  public override toJSON(): CommandOptionDefinition {
    return {
      ...super.toJSON(),
      choices: this.choices,
      autocomplete: this.autocomplete,
      minLength: this.minLength,
      maxLength: this.maxLength,
    };
  }
}

export class SlashCommandNumericOptionBase extends SlashCommandOptionBase {
  public choices?: CommandOptionChoice<number>[];
  public autocomplete = false;
  public minValue?: number;
  public maxValue?: number;

  public setAutocomplete(autocomplete = true): this {
    this.autocomplete = autocomplete;
    return this;
  }

  public setMinValue(min: number): this {
    this.minValue = min;
    return this;
  }

  public setMaxValue(max: number): this {
    this.maxValue = max;
    return this;
  }

  public addChoices(...choices: CommandOptionChoice<number>[]): this {
    if (!this.choices) this.choices = [];
    this.choices.push(...choices);
    return this;
  }

  public setChoices(...choices: CommandOptionChoice<number>[]): this {
    this.choices = [...choices];
    return this;
  }

  public override toJSON(): CommandOptionDefinition {
    return {
      ...super.toJSON(),
      choices: this.choices,
      autocomplete: this.autocomplete,
      minValue: this.minValue,
      maxValue: this.maxValue,
    };
  }
}

export class SlashCommandIntegerOption extends SlashCommandNumericOptionBase {
  constructor() {
    super("Integer");
  }
}

export class SlashCommandNumberOption extends SlashCommandNumericOptionBase {
  constructor() {
    super("Number");
  }
}

export class SlashCommandBooleanOption extends SlashCommandOptionBase {
  constructor() {
    super("Boolean");
  }
}

export class SlashCommandUserOption extends SlashCommandOptionBase {
  constructor() {
    super("User");
  }
}

export class SlashCommandChannelOption extends SlashCommandOptionBase {
  public channelTypes?: number[];

  constructor() {
    super("Channel");
  }

  public addChannelTypes(...types: number[]): this {
    if (!this.channelTypes) this.channelTypes = [];
    this.channelTypes.push(...types);
    return this;
  }

  public override toJSON(): CommandOptionDefinition {
    return {
      ...super.toJSON(),
      channelTypes: this.channelTypes,
    };
  }
}

export class SlashCommandRoleOption extends SlashCommandOptionBase {
  constructor() {
    super("Role");
  }
}

export class SlashCommandMentionableOption extends SlashCommandOptionBase {
  constructor() {
    super("Mentionable");
  }
}

export class SlashCommandAttachmentOption extends SlashCommandOptionBase {
  constructor() {
    super("Attachment");
  }
}

export class SlashCommandSubcommandBuilder {
  public name = "";
  public description = "";
  public options: SlashCommandOptionBase[] = [];

  public setName(name: string): this {
    this.name = name.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    return this;
  }

  public setDescription(description: string): this {
    this.description = description;
    return this;
  }

  public addStringOption(input: (option: SlashCommandStringOption) => SlashCommandStringOption): this {
    const opt = input(new SlashCommandStringOption());
    this.options.push(opt);
    return this;
  }

  public addIntegerOption(input: (option: SlashCommandIntegerOption) => SlashCommandIntegerOption): this {
    const opt = input(new SlashCommandIntegerOption());
    this.options.push(opt);
    return this;
  }

  public addNumberOption(input: (option: SlashCommandNumberOption) => SlashCommandNumberOption): this {
    const opt = input(new SlashCommandNumberOption());
    this.options.push(opt);
    return this;
  }

  public addBooleanOption(input: (option: SlashCommandBooleanOption) => SlashCommandBooleanOption): this {
    const opt = input(new SlashCommandBooleanOption());
    this.options.push(opt);
    return this;
  }

  public addUserOption(input: (option: SlashCommandUserOption) => SlashCommandUserOption): this {
    const opt = input(new SlashCommandUserOption());
    this.options.push(opt);
    return this;
  }

  public addChannelOption(input: (option: SlashCommandChannelOption) => SlashCommandChannelOption): this {
    const opt = input(new SlashCommandChannelOption());
    this.options.push(opt);
    return this;
  }

  public addRoleOption(input: (option: SlashCommandRoleOption) => SlashCommandRoleOption): this {
    const opt = input(new SlashCommandRoleOption());
    this.options.push(opt);
    return this;
  }

  public addMentionableOption(input: (option: SlashCommandMentionableOption) => SlashCommandMentionableOption): this {
    const opt = input(new SlashCommandMentionableOption());
    this.options.push(opt);
    return this;
  }

  public addAttachmentOption(input: (option: SlashCommandAttachmentOption) => SlashCommandAttachmentOption): this {
    const opt = input(new SlashCommandAttachmentOption());
    this.options.push(opt);
    return this;
  }

  public toJSON(): CommandOptionDefinition {
    return {
      type: "Subcommand",
      name: this.name,
      description: this.description,
      options: this.options.map((o) => o.toJSON()),
    };
  }
}

export class SlashCommandSubcommandGroupBuilder {
  public name = "";
  public description = "";
  public subcommands: SlashCommandSubcommandBuilder[] = [];

  public setName(name: string): this {
    this.name = name.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    return this;
  }

  public setDescription(description: string): this {
    this.description = description;
    return this;
  }

  public addSubcommand(
    input: (sub: SlashCommandSubcommandBuilder) => SlashCommandSubcommandBuilder
  ): this {
    const sub = input(new SlashCommandSubcommandBuilder());
    this.subcommands.push(sub);
    return this;
  }

  public toJSON(): CommandOptionDefinition {
    return {
      type: "SubcommandGroup",
      name: this.name,
      description: this.description,
      options: this.subcommands.map((s) => s.toJSON()),
    };
  }
}

export class SlashCommandBuilder {
  public name = "";
  public description = "";
  public options: (
    | SlashCommandOptionBase
    | SlashCommandSubcommandBuilder
    | SlashCommandSubcommandGroupBuilder
  )[] = [];
  public defaultMemberPermissions?: PermissionResolvable;
  public dmPermission?: boolean;
  public nsfw?: boolean;

  public setName(name: string): this {
    this.name = name.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    return this;
  }

  public setDescription(description: string): this {
    this.description = description;
    return this;
  }

  public setDefaultMemberPermissions(permissions: PermissionResolvable): this {
    this.defaultMemberPermissions = permissions;
    return this;
  }

  public setDMPermission(enabled = true): this {
    this.dmPermission = enabled;
    return this;
  }

  public setNSFW(nsfw = true): this {
    this.nsfw = nsfw;
    return this;
  }

  public addStringOption(input: (option: SlashCommandStringOption) => SlashCommandStringOption): this {
    const opt = input(new SlashCommandStringOption());
    this.options.push(opt);
    return this;
  }

  public addIntegerOption(input: (option: SlashCommandIntegerOption) => SlashCommandIntegerOption): this {
    const opt = input(new SlashCommandIntegerOption());
    this.options.push(opt);
    return this;
  }

  public addNumberOption(input: (option: SlashCommandNumberOption) => SlashCommandNumberOption): this {
    const opt = input(new SlashCommandNumberOption());
    this.options.push(opt);
    return this;
  }

  public addBooleanOption(input: (option: SlashCommandBooleanOption) => SlashCommandBooleanOption): this {
    const opt = input(new SlashCommandBooleanOption());
    this.options.push(opt);
    return this;
  }

  public addUserOption(input: (option: SlashCommandUserOption) => SlashCommandUserOption): this {
    const opt = input(new SlashCommandUserOption());
    this.options.push(opt);
    return this;
  }

  public addChannelOption(input: (option: SlashCommandChannelOption) => SlashCommandChannelOption): this {
    const opt = input(new SlashCommandChannelOption());
    this.options.push(opt);
    return this;
  }

  public addRoleOption(input: (option: SlashCommandRoleOption) => SlashCommandRoleOption): this {
    const opt = input(new SlashCommandRoleOption());
    this.options.push(opt);
    return this;
  }

  public addMentionableOption(input: (option: SlashCommandMentionableOption) => SlashCommandMentionableOption): this {
    const opt = input(new SlashCommandMentionableOption());
    this.options.push(opt);
    return this;
  }

  public addAttachmentOption(input: (option: SlashCommandAttachmentOption) => SlashCommandAttachmentOption): this {
    const opt = input(new SlashCommandAttachmentOption());
    this.options.push(opt);
    return this;
  }

  public addSubcommand(
    input: (sub: SlashCommandSubcommandBuilder) => SlashCommandSubcommandBuilder
  ): this {
    const sub = input(new SlashCommandSubcommandBuilder());
    this.options.push(sub);
    return this;
  }

  public addSubcommandGroup(
    input: (group: SlashCommandSubcommandGroupBuilder) => SlashCommandSubcommandGroupBuilder
  ): this {
    const group = input(new SlashCommandSubcommandGroupBuilder());
    this.options.push(group);
    return this;
  }

  public toJSON(): Partial<CommandDefinition> {
    return {
      name: this.name,
      description: this.description,
      type: ApplicationCommandType.ChatInput,
      options: this.options.map((opt) => opt.toJSON()),
      defaultMemberPermissions: this.defaultMemberPermissions,
      dmPermission: this.dmPermission,
      nsfw: this.nsfw,
    };
  }
}
