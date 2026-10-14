import { defineRoute } from "@shardjs/core";
import { timingSafeEqual } from "node:crypto";

function isAuthorized(req: Request): boolean {
  const secret = process.env.API_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const authHeader = req.headers.get("authorization") || "";
  const got = Buffer.from(authHeader);
  return (
    expected.length > 7 &&
    got.length === expected.length &&
    timingSafeEqual(got, expected)
  );
}

export const GET = defineRoute(async ({ request, params, bot }) => {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const guildId = params.id;
  const guild = bot.guilds.get(guildId) || bot.guilds.cache?.get(guildId);

  if (!guild) {
    return Response.json(
      { error: "Guild not found or bot is not a member" },
      { status: 404 }
    );
  }

  return Response.json({
    id: guild.id,
    name: guild.name,
    memberCount: guild.member_count ?? guild.memberCount,
    icon: typeof guild.iconURL === "function" ? guild.iconURL() : guild.icon,
  });
});

export const POST = defineRoute(async ({ request, params, bot }) => {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const guildId = params.id;
  const guild = bot.guilds.get(guildId) || bot.guilds.cache?.get(guildId);

  if (!guild) {
    return Response.json({ error: "Guild not found" }, { status: 404 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.channelId || typeof body.channelId !== "string") {
    return Response.json({ error: "Missing or invalid channelId" }, { status: 400 });
  }

  const channel = guild.channels?.cache?.get(body.channelId) || bot.channels.get(body.channelId);

  // Send message with enforced allowedMentions: { parse: [] } to prevent mention abuse (Issue #7)
  const messageContent = String(body.message || "Hello from shard REST API!").slice(0, 2000);

  if (channel && typeof channel.send === "function") {
    await channel.send({
      content: messageContent,
      allowedMentions: { parse: [] },
    });
    return Response.json({ success: true, sentTo: body.channelId });
  }

  // Fallback to bot.rest directly if channel not in cache
  try {
    await bot.rest.post(`/channels/${body.channelId}/messages`, {
      body: {
        content: messageContent,
        allowed_mentions: { parse: [] },
      },
    });
    return Response.json({ success: true, sentTo: body.channelId });
  } catch (err: any) {
    return Response.json(
      { error: `Failed to send message: ${err.message}` },
      { status: 400 }
    );
  }
});
