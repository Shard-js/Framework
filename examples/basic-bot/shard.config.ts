import { defineConfig } from "@shardjs/core";
import { drizzlePlugin } from "@shardjs/plugin-drizzle";
import { GatewayIntentBits } from "discord-api-types/v10";
import { z } from "zod";

export default defineConfig({
  token: process.env.DISCORD_TOKEN,
  devGuildId: process.env.DEV_GUILD_ID,
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  api: {
    port: 3000,
    prefix: "/api",
    cors: {
      origin: "*",
      methods: ["GET", "POST", "OPTIONS"],
    },
  },
  env: z.object({
    DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN must not be empty"),
    DEV_GUILD_ID: z.string().optional(),
  }),
  plugins: [
    drizzlePlugin(),
  ],
});
