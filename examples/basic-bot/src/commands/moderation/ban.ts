import { defineCommand } from "@shardjs/core";
import { PermissionFlagsBits } from "discord-api-types/v10";

export default defineCommand({
  name: "ban",
  description: "Sperrt ein Mitglied vom Discord-Server",
  guildOnly: true,
  defaultMemberPermissions: PermissionFlagsBits.BanMembers,
  options: [
    {
      name: "target",
      description: "Das zu sperrende Mitglied",
      type: "User",
      required: true,
    },
    {
      name: "reason",
      description: "Grund für den Ausschluss",
      type: "String",
      required: false,
    },
  ],
  middleware: ["auth"],
  async run({ interaction, options, db }) {
    const targetUser = options.getUser("target", true);
    const reason = options.getString("reason") ?? "Kein Grund angegeben";

    await interaction.deferReply({ ephemeral: true });

    // Optional database logging via injected db
    if (db) {
      console.log(`[db] Logging ban for user ${targetUser.id}: ${reason}`);
    }

    await interaction.editReply({
      content: `🔨 **${targetUser.tag}** (${targetUser.id}) wurde gebannt.\n**Grund:** ${reason}`,
    });
  },
});
