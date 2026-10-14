import { defineCommand } from "@shardjs/core";

export default defineCommand({
  name: "ping",
  description: "Displays the bot's WebSocket latency",
  async run({ interaction, bot }) {
    const ping = bot.ws.ping;
    await interaction.reply({
      content: `🏓 Pong! WebSocket Latency: **${ping}ms**`,
    });
  },
});
