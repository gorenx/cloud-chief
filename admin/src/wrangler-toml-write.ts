import fs from "node:fs";
import path from "node:path";

function readToml(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

/** 在 [vars] 段内更新已有键、追加新键；若无 [vars] 则新建 */
export function setWranglerVars(toml: string, vars: Record<string, string>): string {
  const lines = toml.split("\n");
  let start = lines.findIndex((l) => l.trim() === "[vars]");
  if (start === -1) {
    lines.push("", "[vars]");
    start = lines.length - 1;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith("[")) {
      end = i;
      break;
    }
  }
  const remaining = { ...vars };
  for (let i = start + 1; i < end; i++) {
    const m = lines[i].match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*=\s*.*$/);
    if (!m) continue;
    const key = m[2];
    if (key in remaining) {
      lines[i] = `${m[1]}${key} = ${JSON.stringify(remaining[key])}`;
      delete remaining[key];
    }
  }
  const toInsert = Object.entries(remaining).map(
    ([k, v]) => `${k} = ${JSON.stringify(v)}`,
  );
  if (toInsert.length) lines.splice(end, 0, ...toInsert);
  return lines.join("\n");
}

export function writeWranglerVars(
  workerDir: string,
  vars: Record<string, string>,
): { ok: true } | { ok: false; error: string } {
  const file = path.join(workerDir, "wrangler.toml");
  const toml = readToml(file);
  if (!toml) return { ok: false, error: "wrangler.toml 不存在" };
  try {
    fs.writeFileSync(file, setWranglerVars(toml, vars));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** 扫描 root 下含 wrangler.toml 的目录，返回绝对路径。 */
export function discoverWorkerDirs(root: string): string[] {
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
      out.push(abs);
    }
    for (const e of entries) {
      if (e.isDirectory() && e.name !== "node_modules" && !e.name.startsWith(".")) {
        walk(path.join(abs, e.name), depth + 1);
      }
    }
  };
  walk(root, 0);
  return out.sort();
}

/** 把所有 Worker 目录的 wrangler.toml [vars] 同步为同一组值。 */
export function writeWranglerVarsAll(
  workerRoot: string,
  vars: Record<string, string>,
): { ok: true; updated: string[] } | { ok: false; error: string; updated: string[] } {
  const dirs = discoverWorkerDirs(workerRoot);
  if (dirs.length === 0) {
    return { ok: false, error: "未找到 wrangler.toml", updated: [] };
  }
  const updated: string[] = [];
  for (const dir of dirs) {
    const rel = path.relative(workerRoot, dir) || ".";
    const wr = writeWranglerVars(dir, vars);
    if (!wr.ok) return { ok: false, error: `${rel}: ${wr.error}`, updated };
    updated.push(rel);
  }
  return { ok: true, updated };
}
