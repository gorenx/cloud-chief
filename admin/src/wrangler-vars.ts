import fs from "node:fs";
import path from "node:path";

/** 解析 wrangler.toml 顶层 name、[vars] 与 [dev].port */
export function readWranglerToml(dir: string): {
  name: string | null;
  vars: Record<string, string>;
  dev_port: number | null;
} {
  const file = path.join(dir, "wrangler.toml");
  let name: string | null = null;
  const vars: Record<string, string> = {};
  let dev_port: number | null = null;
  try {
    const toml = fs.readFileSync(file, "utf8");
    let section: string | null = null;
    for (const line of toml.split("\n")) {
      const t = line.trim();
      if (t.startsWith("[")) {
        const sm = t.match(/^\[+([^\]]+)\]+/);
        section = sm ? sm[1] : null;
        continue;
      }
      if (!t || t.startsWith("#")) continue;
      if (section === null) {
        const nm = t.match(/^name\s*=\s*(.+)$/);
        if (nm) name = unquote(nm[1].trim());
        continue;
      }
      if (section === "dev") {
        const pm = t.match(/^port\s*=\s*(\d+)\s*$/);
        if (pm) dev_port = Number(pm[1]);
        continue;
      }
      if (section !== "vars") continue;
      const m = t.match(/^([A-Z0-9_]+)\s*=\s*(.+)$/);
      if (m) vars[m[1]] = unquote(m[2].trim());
    }
  } catch {
    /* 目录或文件不存在 */
  }
  return { name, vars, dev_port };
}

function unquote(v: string): string {
  if (v.startsWith('"')) {
    const end = v.indexOf('"', 1);
    return end > 0 ? v.slice(1, end) : v.slice(1);
  }
  if (v.startsWith("'")) {
    const end = v.indexOf("'", 1);
    return end > 0 ? v.slice(1, end) : v.slice(1);
  }
  return v;
}
