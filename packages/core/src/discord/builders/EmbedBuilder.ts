import type {
  DiscordEmbed,
  DiscordEmbedAuthor,
  DiscordEmbedField,
  DiscordEmbedFooter,
  DiscordEmbedImage,
  DiscordEmbedThumbnail,
} from "../types/entities.js";

export class EmbedBuilder {
  private data: DiscordEmbed = {};

  constructor(data: Partial<DiscordEmbed> = {}) {
    this.data = { ...data };
    if (data.fields) {
      this.data.fields = [...data.fields];
    }
  }

  public setTitle(title: string): this {
    this.data.title = title;
    return this;
  }

  public setDescription(description: string): this {
    this.data.description = description;
    return this;
  }

  public setURL(url: string): this {
    this.data.url = url;
    return this;
  }

  public setColor(color: number | string): this {
    if (typeof color === "string") {
      this.data.color = parseInt(color.replace(/^#/, ""), 16);
    } else {
      this.data.color = color;
    }
    return this;
  }

  public setTimestamp(timestamp: Date | number | string = new Date()): this {
    if (timestamp instanceof Date) {
      this.data.timestamp = timestamp.toISOString();
    } else if (typeof timestamp === "number") {
      this.data.timestamp = new Date(timestamp).toISOString();
    } else {
      this.data.timestamp = new Date(timestamp).toISOString();
    }
    return this;
  }

  public setFooter(footer: DiscordEmbedFooter): this {
    this.data.footer = footer;
    return this;
  }

  public setImage(url: string): this {
    this.data.image = { url };
    return this;
  }

  public setThumbnail(url: string): this {
    this.data.thumbnail = { url };
    return this;
  }

  public setAuthor(author: DiscordEmbedAuthor): this {
    this.data.author = author;
    return this;
  }

  public addFields(...fields: DiscordEmbedField[]): this {
    if (!this.data.fields) this.data.fields = [];
    this.data.fields.push(...fields);
    return this;
  }

  public setFields(...fields: DiscordEmbedField[]): this {
    this.data.fields = [...fields];
    return this;
  }

  public toJSON(): DiscordEmbed {
    return { ...this.data };
  }
}
