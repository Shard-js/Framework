import { defineRoute } from "@shardjs/core";

export const GET = defineRoute(async ({ bot }) => {
  return Response.json({
    status: "ok",
    botReady: Boolean(bot.isReady()),
    botUser: bot.user?.tag ?? null,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});
