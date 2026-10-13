import { defineEvent } from "@shardjs/core";

export default defineEvent({
  event: "ready",
  once: true,
  async run(client) {
    console.log(`🤖 [basic-bot] Eingeloggt als: ${client.user.tag}`);
    console.log(`📡 [basic-bot] Verbunden mit ${client.guilds.cache.size} Servern.`);
  },
});
