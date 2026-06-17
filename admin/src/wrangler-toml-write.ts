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
