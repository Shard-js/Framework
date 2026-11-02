import fs from "node:fs";
import path from "node:path";
import type { RawFile } from "../rest/RestClient.js";

export interface AttachmentDataOptions {
  name?: string;
  description?: string;
  contentType?: string;
}

export class AttachmentBuilder {
  public data: Buffer | Uint8Array;
  public name: string;
  public description?: string;
  public contentType?: string;

  constructor(
    attachment: Buffer | Uint8Array | string,
    options: AttachmentDataOptions = {}
  ) {
    if (typeof attachment === "string") {
      if (fs.existsSync(attachment)) {
        this.data = fs.readFileSync(attachment);
        this.name = options.name || path.basename(attachment);
      } else {
        this.data = Buffer.from(attachment, "utf-8");
        this.name = options.name || "file.txt";
      }
    } else {
      this.data = attachment;
      this.name = options.name || "attachment";
    }

    this.description = options.description;
    this.contentType = options.contentType;
  }

  public setName(name: string): this {
    this.name = name;
    return this;
  }

  public setDescription(description: string): this {
    this.description = description;
    return this;
  }

  public setContentType(contentType: string): this {
    this.contentType = contentType;
    return this;
  }

  public toRawFile(): RawFile {
    return {
      name: this.name,
      data: this.data,
      description: this.description,
      contentType: this.contentType,
    };
  }
}
