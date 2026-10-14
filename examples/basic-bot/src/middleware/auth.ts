import { defineMiddleware, PermissionFlagsBits } from "@shardjs/core";

export default defineMiddleware({
  name: "auth",
  async run(ctx, next) {
    const i = ctx.interaction;
    if (i && typeof i.isChatInputCommand === "function" && i.isChatInputCommand()) {
      if (!i.inGuild() || !i.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
        await i.reply({
          content: "❌ You lack the required permissions to perform this action.",
          ephemeral: true,
        });
        return; // Fail closed: do NOT call next()
      }
    }

    await next();
  },
});
