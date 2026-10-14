import { defineConfig, GatewayIntentBits } from "@shardjs/core";
import { drizzlePlugin } from "@shardjs/plugin-drizzle";
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
    host: "127.0.0.1",
    prefix: "/api",
    cors: {
      origin: ["http://localhost:3000"],
      methods: ["GET", "POST", "OPTIONS"],
    },
  },
  env: z.object({
    DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN must not be empty"),
    DEV_GUILD_ID: z.string().optional(),
    API_SECRET: z.string().optional(),
  }),
  plugins: [
    drizzlePlugin(),
  ],
});
