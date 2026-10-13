import fs from "node:fs";
import path from "node:path";
import colors from "picocolors";
import { fork } from "node:child_process";

export interface StartOptions {
  port?: number;
}

export async function runStart(options: StartOptions = {}): Promise<void> {
  const rootDir = process.cwd();
  const runnerPath = path.join(rootDir, ".shard/dist/runner.js");

  if (!fs.existsSync(runnerPath)) {
    console.error(
      colors.red("\n❌ Production build not found!\n") +
        colors.yellow("Please run ") +
        colors.cyan("shard build") +
        colors.yellow(" before starting the production bot.\n")
    );
    process.exit(1);
  }

  console.log(colors.cyan(colors.bold("\n🚀 shard start - Starting production runner...\n")));

  const env: Record<string, string | undefined> = {
    ...process.env,
    NODE_ENV: "production",
  };
  if (options.port) {
    env.PORT = String(options.port);
  }

  const child = fork(runnerPath, [], {
    env,
    cwd: rootDir,
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });

  process.on("SIGINT", () => {
    child.kill("SIGINT");
  });
  process.on("SIGTERM", () => {
    child.kill("SIGTERM");
  });
}
