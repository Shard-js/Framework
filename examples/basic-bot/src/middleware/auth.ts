import { defineMiddleware } from "@shardjs/core";

export default defineMiddleware({
  name: "auth",
  async run(ctx, next) {
    // Check if interaction has permissions
    if (ctx.interaction && ctx.interaction.isChatInputCommand()) {
      const member = ctx.interaction.member;
      console.log(`[middleware:auth] Checking permissions for ${ctx.interaction.user.tag}`);
    }

    await next();
  },
});
