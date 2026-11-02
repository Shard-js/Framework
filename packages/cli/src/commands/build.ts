import fs from "node:fs";
import path from "node:path";
import esbuild from "esbuild";
import colors from "picocolors";
import { FileRouter, loadConfig } from "@shardjs-framework/core";

export interface BuildOptions {
  outDir?: string;
  sourcemap?: boolean;
}

export async function runBuild(options: BuildOptions = {}): Promise<void> {
  const rootDir = process.cwd();
  const outDir = path.resolve(rootDir, options.outDir || ".shard/dist");
  const startTime = performance.now();

  console.log(colors.cyan(colors.bold("\n📦 shard build - Compiling for production...\n")));

  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  const srcDir = path.join(rootDir, "src");

  const router = new FileRouter(rootDir);
  const entryPoints = router.getFilesRecursively(srcDir);

  if (entryPoints.length > 0) {
    await esbuild.build({
      entryPoints,
      outdir: outDir,
      outbase: srcDir,
      format: "esm",
      target: "node20",
      platform: "node",
      sourcemap: options.sourcemap ?? false,
      bundle: false, // keep file structure intact for file routing
    });
  }

  const configFileTs = path.join(rootDir, "shard.config.ts");
  const configFileJs = path.join(rootDir, "shard.config.js");
  const configFileMjs = path.join(rootDir, "shard.config.mjs");
  const configSource = fs.existsSync(configFileTs)
    ? configFileTs
    : fs.existsSync(configFileJs)
    ? configFileJs
    : fs.existsSync(configFileMjs)
    ? configFileMjs
    : null;

  if (configSource) {
    await esbuild.build({
      entryPoints: [configSource],
      outfile: path.join(outDir, "shard.config.js"),
      format: "esm",
      target: "node20",
      platform: "node",
      sourcemap: options.sourcemap ?? false,
      bundle: false,
    });
  }

  const prodRunnerContent = `import { createBot } from "@shardjs-framework/core";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const distDir = __dirname;

let config = {};
const compiledConfigPath = path.join(distDir, "shard.config.js");
if (fs.existsSync(compiledConfigPath)) {
  const mod = await import(pathToFileURL(compiledConfigPath).href);
  config = mod.default || mod;
} else {
  const { loadConfig } = await import("@shardjs-framework/core");
  const loaded = await loadConfig(rootDir);
  config = loaded.config;
}

if (process.env.PORT && config.api) {
  const p = Number(process.env.PORT);
  if (!Number.isNaN(p) && p > 0 && p <= 65535) {
    config.api.port = p;
  }
}

const bot = createBot(config, rootDir, { distDir, isProduction: true });

const shutdown = async () => {
  try {
    await bot.stop();
  } catch (err) {
    console.error("[shard] Error during graceful shutdown:", err);
  } finally {
    process.exit(0);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await bot.start();
console.log("[shard] Production bot running.");
`;

  fs.writeFileSync(path.join(outDir, "runner.js"), prodRunnerContent, "utf-8");

  const prodRouter = new FileRouter(rootDir, undefined, { distDir: outDir, isProduction: true });
  await prodRouter.loadAll();

  const elapsed = (performance.now() - startTime).toFixed(0);
  console.log(colors.green(`✅ Build completed in ${elapsed}ms`));
  console.log(colors.gray(`   Output directory: ${path.relative(rootDir, outDir)}`));
  console.log(colors.cyan(`   • Slash Commands: ${prodRouter.commands.size}`));
  console.log(colors.cyan(`   • Gateway Events: ${prodRouter.events.size}`));
  console.log(colors.cyan(`   • Middleware: ${prodRouter.middlewares.size}\n`));
}
