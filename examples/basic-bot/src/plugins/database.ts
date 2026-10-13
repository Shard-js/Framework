import { definePlugin } from "@shardjs/core";

export default definePlugin({
  name: "local-database",
  async setup({ bot, inject }) {
    console.log("🔌 [local-database] Initializing local database plugin...");
    inject("analytics", {
      recordCommandUsage(cmdName: string) {
        console.log(`[analytics] Command used: ${cmdName}`);
      },
    });
  },
  async teardown() {
    console.log("🔌 [local-database] Tearing down local database plugin...");
  },
});
