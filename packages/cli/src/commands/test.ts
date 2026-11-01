import { spawn } from "node:child_process";
import colors from "picocolors";

export interface TestCliOptions {
  watch?: boolean;
  coverage?: boolean;
}

export async function runTest(options: TestCliOptions = {}): Promise<void> {
  console.log(colors.cyan(colors.bold("\n🧪 shard test - Running project tests...\n")));

  const args = ["vitest", options.watch ? "watch" : "run"];
  if (options.coverage) {
    args.push("--coverage");
  }

  const isWindows = process.platform === "win32";
  const cmd = isWindows ? "npx.cmd" : "npx";

  const child = spawn(cmd, args, {
    stdio: "inherit",
    cwd: process.cwd(),
    shell: isWindows,
  });

  child.on("close", (code) => {
    if (code !== 0) {
      console.error(colors.red(`\n❌ Tests failed with exit code ${code}`));
      process.exit(code || 1);
    } else {
      console.log(colors.green("\n✅ All tests passed!"));
    }
  });
}
