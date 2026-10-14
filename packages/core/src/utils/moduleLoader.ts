import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import esbuild from "esbuild";

export async function importModule<T = any>(
  filePath: string,
  rootDir: string = process.cwd()
): Promise<T> {
  const isTypeScript = filePath.endsWith(".ts") && !filePath.endsWith(".d.ts");

  if (!isTypeScript) {
    const fileUrl = `${pathToFileURL(filePath).href}?t=${Date.now()}`;
    const mod = await import(fileUrl);
    return mod.default || mod;
  }

  const cacheDir = path.join(rootDir, ".shard", "cache");
  const relPath = path.relative(rootDir, filePath);
  const cacheFilePath = path.join(
    cacheDir,
    relPath.replace(/\.ts$/, ".js")
  );

  fs.mkdirSync(path.dirname(cacheFilePath), { recursive: true });

  await esbuild.build({
    entryPoints: [filePath],
    outfile: cacheFilePath,
    format: "esm",
    target: "node20",
    platform: "node",
    bundle: false,
    packages: "external",
    sourcemap: "inline",
  });

  const fileUrl = `${pathToFileURL(cacheFilePath).href}?t=${Date.now()}`;
  const mod = await import(fileUrl);
  return mod.default || mod;
}
