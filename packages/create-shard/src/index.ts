import colors from "picocolors";
import readline from "node:readline/promises";

export async function runCreateShard(): Promise<void> {
  const args = process.argv.slice(2);
  let targetName = args.find((a) => !a.startsWith("-"));
  let templateArg = args
    .find((a) => a.startsWith("--template=") || a.startsWith("-t="))
    ?.split("=")[1];

  if (!templateArg) {
    const tIndex = args.findIndex((a) => a === "--template" || a === "-t");
    if (tIndex !== -1 && args[tIndex + 1]) {
      templateArg = args[tIndex + 1];
    }
  }

  if (!targetName || !templateArg) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(colors.cyan(colors.bold("\n💎 Welcome to create-shard!\n")));

    if (!targetName) {
      targetName =
        (await rl.question(colors.bold("Project name: (my-shard-bot) "))) ||
        "my-shard-bot";
    }

    if (!templateArg) {
      console.log("\nAvailable templates:");
      console.log("  1) minimal       - Minimal TypeScript Bot (Slash commands & Events)");
      console.log("  2) api-drizzle   - Bot + HTTP REST API + Drizzle ORM plugin");
      console.log("  3) moderation    - Multi-Guild Moderation with folder subcommands & middleware");

      const answer = (
        await rl.question(colors.bold("\nChoose template (1/2/3 or name): [1] "))
      ).trim();

      if (answer === "2" || answer === "api-drizzle" || answer === "drizzle") {
        templateArg = "api-drizzle";
      } else if (answer === "3" || answer === "moderation") {
        templateArg = "moderation";
      } else {
        templateArg = "minimal";
      }
    }

    rl.close();
  }

  targetName = targetName.trim() || "my-shard-bot";
  const template =
    templateArg === "api-drizzle" || templateArg === "moderation"
      ? templateArg
      : "minimal";

  try {
    const { runCreate } = await import("@shardjs/cli");
    await runCreate(targetName, { template });
  } catch (err: any) {
    console.error(
      colors.red(`\n❌ Failed to scaffold project '${targetName}':`),
      err.message
    );
  }
}
