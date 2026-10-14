import fs from "node:fs";
import path from "node:path";
import esbuild from "esbuild";
import colors from "picocolors";
import { FileRouter, loadConfig } from "@shardjs/core";

export interface BuildOptions {
  outDir?: string;
  sourcemap?: boolean;
}

export async function runBuild(options: BuildOptions = {}): Promise<void> {
  const rootDir = process.cwd();
  const outDir = path.resolve(rootDir, options.outDir || ".shard/dist");
  const startTime = performance.now();

  console.log(colors.cyan(colors.bold("\n📦 shard build - Compiling for production...\n")));

  // Clean outDir
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  const srcDir = path.join(rootDir, "src");

  // Collect entry files
  const router = new FileRouter(rootDir);
  const entryPoints = router.getFilesRecursively(srcDir);

  const configFile = path.join(rootDir, "shard.config.ts");
  if (fs.existsSync(configFile)) {
    entryPoints.push(configFile);
  }

  // Compile with esbuild (sourcemaps disabled by default in production, Issue #15)
  await esbuild.build({
    entryPoints,
    outdir: outDir,
    format: "esm",
    target: "node20",
    platform: "node",
    sourcemap: options.sourcemap ?? false,
    bundle: false, // keep file structure intact for file routing
  });

  // Generate production runner entrypoint with correct rootDir resolution (Issue #4)
  const prodRunnerContent = `import { loadConfig, createBot } from "@shardjs/core";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Runner is located at <project>/.shard/dist/runner.js -> rootDir is ../..
const rootDir = path.resolve(__dirname, "../..");

const { config } = await loadConfig(rootDir);
const bot = createBot(config, rootDir);

await bot.start();
console.log("[shard] Production bot running.");
`;

  fs.writeFileSync(path.join(outDir, "runner.js"), prodRunnerContent, "utf-8");

  // Router summary
  await router.loadAll();

  const elapsed = (performance.now() - startTime).toFixed(0);
  console.log(colors.green(`✅ Build completed in ${elapsed}ms`));
  console.log(colors.gray(`   Output directory: ${path.relative(rootDir, outDir)}`));
  console.log(colors.cyan(`   • Slash Commands: ${router.commands.size}`));
  console.log(colors.cyan(`   • Gateway Events: ${router.events.size}`));
  console.log(colors.cyan(`   • Middleware: ${router.middlewares.size}\n`));
}
