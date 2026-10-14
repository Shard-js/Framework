
export const PermissionFlagsBits = {
  CreateInstantInvite: 1n << 0n,
  KickMembers: 1n << 1n,
  BanMembers: 1n << 2n,
  Administrator: 1n << 3n,
  ManageChannels: 1n << 4n,
  ManageGuild: 1n << 5n,
  AddReactions: 1n << 6n,
  ViewAuditLog: 1n << 7n,
  PrioritySpeaker: 1n << 8n,
  Stream: 1n << 9n,
  ViewChannel: 1n << 10n,
  SendMessages: 1n << 11n,
  SendTTSMessages: 1n << 12n,
  ManageMessages: 1n << 13n,
  EmbedLinks: 1n << 14n,
  AttachFiles: 1n << 15n,
  ReadMessageHistory: 1n << 16n,
  MentionEveryone: 1n << 17n,
  UseExternalEmojis: 1n << 18n,
  ViewGuildInsights: 1n << 19n,
  Connect: 1n << 20n,
  Speak: 1n << 21n,
  MuteMembers: 1n << 22n,
  DeafenMembers: 1n << 23n,
  MoveMembers: 1n << 24n,
  UseVAD: 1n << 25n,
  ChangeNickname: 1n << 26n,
  ManageNicknames: 1n << 27n,
  ManageRoles: 1n << 28n,
  ManageWebhooks: 1n << 29n,
  ManageGuildExpressions: 1n << 30n,
  UseApplicationCommands: 1n << 31n,
  RequestToSpeak: 1n << 32n,
  ManageEvents: 1n << 33n,
  ManageThreads: 1n << 34n,
  CreatePublicThreads: 1n << 35n,
  CreatePrivateThreads: 1n << 36n,
  UseExternalStickers: 1n << 37n,
  SendMessagesInThreads: 1n << 38n,
  UseEmbeddedActivities: 1n << 39n,
  ModerateMembers: 1n << 40n,
  ViewCreatorMonetizationAnalytics: 1n << 41n,
  UseSoundboard: 1n << 42n,
  CreateGuildExpressions: 1n << 43n,
  CreateEvents: 1n << 44n,
  UseExternalSounds: 1n << 45n,
  SendVoiceMessages: 1n << 46n,
} as const;

export type PermissionResolvable =
  | bigint
  | number
  | string
  | PermissionsBitField
  | PermissionResolvable[];

export class PermissionsBitField {
  public bitfield: bigint;

  public static readonly Flags = PermissionFlagsBits;
  public static readonly All = Object.values(PermissionFlagsBits).reduce(
    (acc, bit) => acc | bit,
    0n
  );

  constructor(bits: PermissionResolvable = 0n) {
    this.bitfield = PermissionsBitField.resolve(bits);
  }

  public has(permission: PermissionResolvable, checkAdmin = true): boolean {
    const bit = PermissionsBitField.resolve(permission);
    if (checkAdmin && (this.bitfield & PermissionFlagsBits.Administrator) !== 0n) {
      return true;
    }
    return (this.bitfield & bit) === bit;
  }

  public any(permission: PermissionResolvable, checkAdmin = true): boolean {
    const bit = PermissionsBitField.resolve(permission);
    if (checkAdmin && (this.bitfield & PermissionFlagsBits.Administrator) !== 0n) {
      return true;
    }
    return (this.bitfield & bit) !== 0n;
  }

  public add(...bits: PermissionResolvable[]): this {
    for (const bit of bits) {
      this.bitfield |= PermissionsBitField.resolve(bit);
    }
    return this;
  }

  public remove(...bits: PermissionResolvable[]): this {
    for (const bit of bits) {
      this.bitfield &= ~PermissionsBitField.resolve(bit);
    }
    return this;
  }

  public toArray(): string[] {
    const result: string[] = [];
    for (const [key, val] of Object.entries(PermissionFlagsBits)) {
      if ((this.bitfield & val) === val) {
        result.push(key);
      }
    }
    return result;
  }

  public toJSON(): string {
    return this.bitfield.toString();
  }

  public toString(): string {
    return this.bitfield.toString();
  }

  public static resolve(permission: PermissionResolvable): bigint {
    if (typeof permission === "bigint") return permission;
    if (typeof permission === "number") return BigInt(permission);
    if (typeof permission === "string") {
      if (permission in PermissionFlagsBits) {
        return (PermissionFlagsBits as Record<string, bigint>)[permission];
      }
      return BigInt(permission);
    }
    if (permission instanceof PermissionsBitField) {
      return permission.bitfield;
    }
    if (Array.isArray(permission)) {
      return permission.reduce<bigint>(
        (acc, p) => acc | PermissionsBitField.resolve(p),
        0n
      );
    }
    throw new TypeError(`Cannot resolve permission: ${String(permission)}`);
  }
}
