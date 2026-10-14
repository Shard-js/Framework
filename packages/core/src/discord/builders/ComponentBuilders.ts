import {
  ComponentType,
  ButtonStyle,
  TextInputStyle,
  type DiscordComponent,
  type DiscordSelectOption,
} from "../types/interactions.js";

export class ActionRowBuilder<T extends ButtonBuilder | StringSelectMenuBuilder | TextInputBuilder = any> {
  public type: ComponentType = ComponentType.ActionRow;
  public components: T[] = [];

  constructor(components: T[] = []) {
    this.components = [...components];
  }

  public addComponents(...components: T[]): this {
    this.components.push(...components);
    return this;
  }

  public setComponents(...components: T[]): this {
    this.components = [...components];
    return this;
  }

  public toJSON(): DiscordComponent {
    return {
      type: ComponentType.ActionRow,
      components: this.components.map((c) => c.toJSON()),
    };
  }
}

export class ButtonBuilder {
  public type: ComponentType = ComponentType.Button;
  private data: DiscordComponent = {
    type: ComponentType.Button,
    style: ButtonStyle.Primary,
  };

  public setCustomId(customId: string): this {
    this.data.custom_id = customId;
    return this;
  }

  public setLabel(label: string): this {
    this.data.label = label;
    return this;
  }

  public setStyle(style: ButtonStyle): this {
    this.data.style = style;
    return this;
  }

  public setEmoji(emoji: { id?: string; name?: string; animated?: boolean }): this {
    this.data.emoji = emoji;
    return this;
  }

  public setDisabled(disabled = true): this {
    this.data.disabled = disabled;
    return this;
  }

  public setURL(url: string): this {
    this.data.url = url;
    this.data.style = ButtonStyle.Link;
    return this;
  }

  public toJSON(): DiscordComponent {
    return { ...this.data };
  }
}

export class StringSelectMenuBuilder {
  public type: ComponentType = ComponentType.StringSelect;
  private data: DiscordComponent = {
    type: ComponentType.StringSelect,
    options: [],
  };

  public setCustomId(customId: string): this {
    this.data.custom_id = customId;
    return this;
  }

  public setPlaceholder(placeholder: string): this {
    this.data.placeholder = placeholder;
    return this;
  }

  public setMinValues(min: number): this {
    this.data.min_values = min;
    return this;
  }

  public setMaxValues(max: number): this {
    this.data.max_values = max;
    return this;
  }

  public setDisabled(disabled = true): this {
    this.data.disabled = disabled;
    return this;
  }

  public addOptions(...options: DiscordSelectOption[]): this {
    if (!this.data.options) this.data.options = [];
    this.data.options.push(...options);
    return this;
  }

  public setOptions(...options: DiscordSelectOption[]): this {
    this.data.options = [...options];
    return this;
  }

  public toJSON(): DiscordComponent {
    return { ...this.data };
  }
}

export class TextInputBuilder {
  public type: ComponentType = ComponentType.TextInput;
  private data: DiscordComponent = {
    type: ComponentType.TextInput,
    style: TextInputStyle.Short,
  };

  public setCustomId(customId: string): this {
    this.data.custom_id = customId;
    return this;
  }

  public setLabel(label: string): this {
    this.data.label = label;
    return this;
  }

  public setStyle(style: TextInputStyle): this {
    this.data.style = style;
    return this;
  }

  public setMinLength(min: number): this {
    this.data.min_length = min;
    return this;
  }

  public setMaxLength(max: number): this {
    this.data.max_length = max;
    return this;
  }

  public setRequired(required = true): this {
    this.data.required = required;
    return this;
  }

  public setValue(value: string): this {
    this.data.value = value;
    return this;
  }

  public setPlaceholder(placeholder: string): this {
    this.data.placeholder = placeholder;
    return this;
  }

  public toJSON(): DiscordComponent {
    return { ...this.data };
  }
}

export class ModalBuilder {
  private customId = "";
  private title = "";
  private components: ActionRowBuilder<TextInputBuilder>[] = [];

  public setCustomId(customId: string): this {
    this.customId = customId;
    return this;
  }

  public setTitle(title: string): this {
    this.title = title;
    return this;
  }

  public addComponents(...components: ActionRowBuilder<TextInputBuilder>[]): this {
    this.components.push(...components);
    return this;
  }

  public toJSON() {
    return {
      custom_id: this.customId,
      title: this.title,
      components: this.components.map((c) => c.toJSON()),
    };
  }
}
