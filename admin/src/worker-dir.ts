import fs from "node:fs";
import path from "node:path";
import { workerDir, workerRoot } from "./env";
import { readWranglerToml } from "./wrangler-vars";

/** 把请求里的 dir 解析为绝对路径，并强制限制在 WORKER_ROOT 白名单内。 */
export function resolveWorkerDirQuery(dir?: string | null): string | null {
  if (!dir) return workerDir;
  const abs = path.resolve(workerRoot, dir);
  const rel = path.relative(workerRoot, abs);
  if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    return null;
  }
  if (!fs.existsSync(path.join(abs, "wrangler.toml"))) return null;
  return abs;
}

export function listWorkerRelDirs(): string[] {
  const out: string[] = [];
  const walk = (abs: string, depth: number): void => {
    if (depth > 3) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((e) => e.isFile() && e.name === "wrangler.toml")) {
      out.push(path.relative(workerRoot, abs) || ".");
    }
    for (const e of entries) {
      if (e.isDirectory() && e.name !== "node_modules" && !e.name.startsWith(".")) {
        walk(path.join(abs, e.name), depth + 1);
      }
    }
  };
  walk(workerRoot, 0);
  return out;
}

export function listWorkerEntries(): Array<{ dir: string; script_name: string | null }> {
  return listWorkerRelDirs().map((rel) => {
    const abs = path.resolve(workerRoot, rel === "." ? workerRoot : path.join(workerRoot, rel));
    const toml = readWranglerToml(abs);
    return { dir: rel, script_name: toml.name ?? null };
  });
}
