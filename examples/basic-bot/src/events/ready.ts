import { defineEvent } from "@shardjs/core";

export default defineEvent({
  event: "ready",
  once: true,
  async run(client) {
    console.log(`[basic-bot] Logged in as: ${client.user?.tag}`);
    console.log(`[basic-bot] Connected to ${client.guilds.size} guild(s).`);
  },
});
