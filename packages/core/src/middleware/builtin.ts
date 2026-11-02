import {
  PermissionsBitField,
  type PermissionResolvable,
} from "../discord/types/permissions.js";
import type { CommandContext, MiddlewareDefinition } from "../types/index.js";

export interface RequireGuildOptions {
  message?: string;
}

export function requireGuild(options: RequireGuildOptions = {}): MiddlewareDefinition<CommandContext> {
  const message = options.message ?? "❌ This command can only be used in a server (Guild).";
  return {
    name: "requireGuild",
    async run(ctx, next) {
      if (!ctx.interaction.inGuild()) {
        await ctx.interaction.reply({
          content: message,
          ephemeral: true,
        });
        return;
      }
      await next();
    },
  };
}

export interface RequirePermissionsOptions {
  message?: string;
  checkAdmin?: boolean;
}

export function requirePermissions(
  permissions: PermissionResolvable,
  options: RequirePermissionsOptions = {}
): MiddlewareDefinition<CommandContext> {
  const message =
    options.message ?? "❌ You lack the required permissions to perform this action.";
  const checkAdmin = options.checkAdmin ?? true;

  return {
    name: "requirePermissions",
    async run(ctx, next) {
      const memberPerms = ctx.interaction.memberPermissions;
      if (!memberPerms || !memberPerms.has(permissions, checkAdmin)) {
        await ctx.interaction.reply({
          content: message,
          ephemeral: true,
        });
        return;
      }
      await next();
    },
  };
}

export interface CooldownOptions {
  scope?: "user" | "guild" | "channel";
  message?: string | ((remainingSec: number) => string);
}

export function cooldown(
  seconds: number,
  options: CooldownOptions = {}
): MiddlewareDefinition<CommandContext> {
  const cooldowns = new Map<string, number>();
  const scope = options.scope ?? "user";

  return {
    name: "cooldown",
    async run(ctx, next) {
      const i = ctx.interaction;
      const targetId =
        scope === "guild"
          ? i.guildId || i.user.id
          : scope === "channel"
          ? i.channelId || i.user.id
          : i.user.id;

      const key = `${i.commandName}:${targetId}`;
      const now = Date.now();
      const expiration = cooldowns.get(key) || 0;

      if (now < expiration) {
        const remainingSec = Math.ceil((expiration - now) / 1000);
        const msg =
          typeof options.message === "function"
            ? options.message(remainingSec)
            : options.message ??
              `⏳ Please wait **${remainingSec}s** before reusing the \`/${i.commandName}\` command.`;

        await i.reply({
          content: msg,
          ephemeral: true,
        });
        return;
      }

      cooldowns.set(key, now + seconds * 1000);
      await next();
    },
  };
}

export interface RateLimitOptions {
  max: number;
  windowMs: number;
  scope?: "user" | "guild";
  message?: string;
}

export function rateLimit(options: RateLimitOptions): MiddlewareDefinition<CommandContext> {
  const limits = new Map<string, { count: number; resetTime: number }>();
  const scope = options.scope ?? "user";
  const defaultMsg = "⚠️ You are executing commands too quickly. Please slow down.";

  return {
    name: "rateLimit",
    async run(ctx, next) {
      const i = ctx.interaction;
      const targetId = scope === "guild" ? i.guildId || i.user.id : i.user.id;
      const key = `${i.commandName}:${targetId}`;
      const now = Date.now();

      let state = limits.get(key);
      if (!state || now > state.resetTime) {
        state = { count: 1, resetTime: now + options.windowMs };
        limits.set(key, state);
        return await next();
      }

      state.count++;
      if (state.count > options.max) {
        await i.reply({
          content: options.message ?? defaultMsg,
          ephemeral: true,
        });
        return;
      }

      await next();
    },
  };
}

export function logCommand(): MiddlewareDefinition<CommandContext> {
  return {
    name: "logCommand",
    async run(ctx, next) {
      const start = performance.now();
      const i = ctx.interaction;
      try {
        await next();
        const duration = (performance.now() - start).toFixed(2);
        ctx.logger?.info(`[shard] /${i.commandName} completed in ${duration}ms by ${i.user.username}`);
      } catch (err: any) {
        const duration = (performance.now() - start).toFixed(2);
        ctx.logger?.error(`[shard] /${i.commandName} failed after ${duration}ms: ${err.message}`);
        throw err;
      }
    },
  };
}
