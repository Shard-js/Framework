import { defineCommand } from "@shardjs/core";

export default defineCommand({
  name: "ping",
  description: "Zeigt die WebSocket-Latenz des Bots an",
  async run({ interaction, bot }) {
    const ping = bot.ws.ping;
    await interaction.reply({
      content: `🏓 Pong! WebSocket Latenz: **${ping}ms**`,
    });
  },
});
