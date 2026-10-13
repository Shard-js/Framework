import { defineEvent } from "@shardjs/core";
import type { Message } from "discord.js";

export default defineEvent({
  event: "messageCreate",
  async run({ bot }, message: Message) {
    if (message.author.bot) return;

    if (message.content === "!ping") {
      await message.reply(`Pong! Latenz: ${bot.ws.ping}ms`);
    }
  },
});
