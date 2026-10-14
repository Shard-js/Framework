import { describe, it, expect } from "vitest";
import {
  PermissionsBitField,
  PermissionFlagsBits,
} from "../src/discord/types/permissions.js";

describe("PermissionsBitField", () => {
  it("resolves and combines permissions correctly", () => {
    const perms = new PermissionsBitField([
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ]);

    expect(perms.has(PermissionFlagsBits.SendMessages)).toBe(true);
    expect(perms.has(PermissionFlagsBits.EmbedLinks)).toBe(true);
    expect(perms.has(PermissionFlagsBits.BanMembers)).toBe(false);
  });

  it("handles Administrator bypass", () => {
    const admin = new PermissionsBitField(PermissionFlagsBits.Administrator);

    expect(admin.has(PermissionFlagsBits.BanMembers)).toBe(true);
    expect(admin.has(PermissionFlagsBits.KickMembers)).toBe(true);
    expect(admin.has(PermissionFlagsBits.BanMembers, false)).toBe(false);
  });

  it("adds and removes permissions dynamically", () => {
    const perms = new PermissionsBitField();
    perms.add(PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers);

    expect(perms.has(PermissionFlagsBits.KickMembers)).toBe(true);
    expect(perms.has(PermissionFlagsBits.BanMembers)).toBe(true);

    perms.remove(PermissionFlagsBits.KickMembers);
    expect(perms.has(PermissionFlagsBits.KickMembers)).toBe(false);
    expect(perms.has(PermissionFlagsBits.BanMembers)).toBe(true);
  });

  it("serializes to BigInt string and array", () => {
    const perms = new PermissionsBitField([
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.AttachFiles,
    ]);

    const arr = perms.toArray();
    expect(arr).toContain("SendMessages");
    expect(arr).toContain("AttachFiles");
    expect(arr).not.toContain("Administrator");

    expect(typeof perms.toJSON()).toBe("string");
    expect(typeof perms.toString()).toBe("string");
  });
});
