import { defineEvent } from "@shardjs/core";

export default defineEvent({
  event: "messageCreate",
  async run({ bot }, message) {
    if (message.author.bot) return;

    if (message.content === "!ping") {
      await message.reply(`Pong! Latency: ${bot.ws.ping}ms`);
    }
  },
});
