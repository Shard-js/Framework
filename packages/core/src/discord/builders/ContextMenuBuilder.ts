import { ApplicationCommandType } from "../types/interactions.js";
import type { PermissionResolvable } from "../types/permissions.js";
import type { CommandDefinition } from "../../types/index.js";

export abstract class ContextMenuCommandBuilder {
  public name = "";
  public abstract type: ApplicationCommandType;
  public defaultMemberPermissions?: PermissionResolvable;
  public dmPermission?: boolean;
  public nsfw?: boolean;

  public setName(name: string): this {
    this.name = name;
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

  public toJSON(): Partial<CommandDefinition> {
    return {
      name: this.name,
      type: this.type,
      defaultMemberPermissions: this.defaultMemberPermissions,
      dmPermission: this.dmPermission,
      nsfw: this.nsfw,
    };
  }
}

export class UserContextMenuBuilder extends ContextMenuCommandBuilder {
  public type: ApplicationCommandType = ApplicationCommandType.User;
}

export class MessageContextMenuBuilder extends ContextMenuCommandBuilder {
  public type: ApplicationCommandType = ApplicationCommandType.Message;
}
