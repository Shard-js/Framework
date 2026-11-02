import { describe, it, expect } from "vitest";
import {
  AttachmentBuilder,
  UserContextMenuBuilder,
  MessageContextMenuBuilder,
  ApplicationCommandType,
  filterChoices,
} from "../src/index.js";

describe("AttachmentBuilder, ContextMenus & filterChoices", () => {
  it("builds raw file from buffer with AttachmentBuilder", () => {
    const buf = Buffer.from("hello world", "utf-8");
    const attachment = new AttachmentBuilder(buf, {
      name: "greeting.txt",
      description: "A test greeting",
      contentType: "text/plain",
    });

    const raw = attachment.toRawFile();
    expect(raw.name).toBe("greeting.txt");
    expect(raw.description).toBe("A test greeting");
    expect(raw.contentType).toBe("text/plain");
    expect(raw.data).toEqual(buf);
  });

  it("builds context menu command definitions", () => {
    const userMenu = new UserContextMenuBuilder()
      .setName("User Info")
      .setDMPermission(false);

    expect(userMenu.toJSON()).toEqual({
      name: "User Info",
      type: ApplicationCommandType.User,
      defaultMemberPermissions: undefined,
      dmPermission: false,
      nsfw: undefined,
    });

    const msgMenu = new MessageContextMenuBuilder().setName("Bookmark Message");
    expect(msgMenu.toJSON().type).toBe(ApplicationCommandType.Message);
  });

  it("filters autocomplete choices with case-insensitivity and limit", () => {
    const choices = [
      { name: "JavaScript", value: "js" },
      { name: "TypeScript", value: "ts" },
      { name: "Python", value: "py" },
      { name: "Rust", value: "rs" },
    ];

    const matchScript = filterChoices("script", choices);
    expect(matchScript).toHaveLength(2);
    expect(matchScript[0].name).toBe("JavaScript");
    expect(matchScript[1].name).toBe("TypeScript");

    const matchEmpty = filterChoices("", choices, 2);
    expect(matchEmpty).toHaveLength(2);

    const matchStrings = filterChoices("ap", ["Apple", "Banana", "Grape"]);
    expect(matchStrings).toEqual([
      { name: "Apple", value: "Apple" },
      { name: "Grape", value: "Grape" },
    ]);
  });
});
