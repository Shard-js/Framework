import path from "node:path";
import colors from "picocolors";
import readline from "node:readline/promises";

export async function runCreateShard(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(colors.cyan(colors.bold("\n💎 Welcome to create-shard!\n")));

  const targetName =
    (await rl.question(colors.bold("Project name: (my-shard-bot) "))) ||
    "my-shard-bot";
  rl.close();

  // Dynamic import of CLI create handler
  try {
    const { runCreate } = await import("@shardjs/cli");
    await runCreate(targetName.trim());
  } catch {
    console.log(
      colors.green(
        `\nScaffolding project '${targetName}'... (Run 'npx shard create ${targetName}')\n`
      )
    );
  }
}
