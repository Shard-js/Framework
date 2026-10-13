import { defineRoute } from "@shardjs/core";

export const GET = defineRoute(async ({ params, bot }) => {
  const guildId = params.id;
  const guild = bot.guilds.cache.get(guildId);

  if (!guild) {
    return Response.json(
      { error: "Guild not found or bot is not a member" },
      { status: 404 }
    );
  }

  return Response.json({
    id: guild.id,
    name: guild.name,
    memberCount: guild.memberCount,
    icon: guild.iconURL(),
  });
});

export const POST = defineRoute(async ({ request, params, bot }) => {
  const guildId = params.id;
  const guild = bot.guilds.cache.get(guildId);

  if (!guild) {
    return Response.json(
      { error: "Guild not found" },
      { status: 404 }
    );
  }

  const body = await request.json();
  const channel = guild.channels.cache.get(body.channelId);

  if (channel && channel.isTextBased()) {
    await channel.send(body.message || "Hello from shard REST API!");
    return Response.json({ success: true, sentTo: channel.id });
  }

  return Response.json(
    { error: "Target channel not found or not text-based" },
    { status: 400 }
  );
});
