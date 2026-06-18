import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import fs from "node:fs";
import path from "node:path";
import { adminAuth } from "../auth";
import { env, workerDir, workerRoot, reloadEnv, setEnvFileValue } from "../env";
import { runWrangler, spawnWrangler } from "../wrangler";
import {
  getWorkerDevProcessStatus,
  probeLocalWorkerHealth,
  startWorkerDev,
} from "../worker-dev-process";
import {
  listCfDeployedWorkers,
  resolveWorkerFromCf,
} from "../cf-worker-resolve";
import {
  getWorkerBuildsStatus,
  syncWorkerBuildsConfig,
  triggerWorkerBuild,
  validateWorkerBuilderToken,
} from "../cf-builds";
import {
  secretSet,
  workerVarsUpdate,
  devVarsUpdate,
  workerBuilderTokenSet,
  zodMessage,
} from "../schemas";

export const deploy = new Hono();

deploy.use("*", adminAuth);

const tomlPath = (dir: string) => path.join(dir, "wrangler.toml");
const devVarsPath = (dir: string) => path.join(dir, ".dev.vars");
const devVarsExamplePath = (dir: string) => path.join(dir, ".dev.vars.example");

function readFileSafe(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

const readToml = (dir: string) => readFileSafe(tomlPath(dir));

// 把请求里的 dir 解析为绝对路径，并强制限制在 WORKER_ROOT 白名单内（防目录穿越）。
// 返回 null 表示非法（越界或不含 wrangler.toml）。dir 为空时回退到默认 workerDir。
function resolveWorkerDir(dir?: string | null): string | null {
  if (!dir) return workerDir;
  const abs = path.resolve(workerRoot, dir);
  const rel = path.relative(workerRoot, abs);
  if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    return null;
  }
  if (!fs.existsSync(tomlPath(abs))) return null;
  return abs;
}

// 扫描 WORKER_ROOT 下含 wrangler.toml 的目录，返回相对路径（用于下拉选择）。
function listWorkers(): string[] {
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

// 私密配置清单：从 .dev.vars.example 解析出 secret 名（注释行视为可选）。
function parseSecretManifest(text: string): Array<{ name: string; optional: boolean }> {
  const seen = new Set<string>();
  const out: Array<{ name: string; optional: boolean }> = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(#\s*)?([A-Z][A-Z0-9_]*)\s*=/);
    if (!m) continue;
    if (seen.has(m[2])) continue;
    seen.add(m[2]);
    out.push({ name: m[2], optional: Boolean(m[1]) });
  }
  return out;
}

// 解析 .dev.vars 为键值对（dotenv 风格）。
function parseDevVars(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const v = m[2].trim();
    if (v.length > 0) out[m[1]] = v;
  }
  return out;
}

// 本地已设置（值非空）的 secret 名集合。
function parseLocalSecretNames(text: string): string[] {
  return Object.keys(parseDevVars(text));
}

// 更新/追加 .dev.vars 的 KEY=value 行（dotenv 风格，不加引号）。
function setDevVars(text: string, secrets: Record<string, string>): string {
  const lines = text.length ? text.split("\n") : [];
  const remaining = { ...secrets };
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)([A-Z][A-Z0-9_]*)\s*=.*$/);
    if (!m) continue;
    const key = m[2];
    if (key in remaining) {
      lines[i] = `${m[1]}${key}=${remaining[key]}`;
      delete remaining[key];
    }
  }
  for (const [k, v] of Object.entries(remaining)) lines.push(`${k}=${v}`);
  return lines.join("\n").replace(/\n*$/, "\n");
}

function parseName(toml: string): string | null {
  const m = toml.match(/^\s*name\s*=\s*"([^"]*)"/m);
  return m ? m[1] : null;
}

function parseCompatibilityDate(toml: string): string | null {
  const m = toml.match(/^\s*compatibility_date\s*=\s*"([^"]*)"/m);
  return m ? m[1] : null;
}

// 解析 [vars] 段为键值对（仅取该段，遇到下一个表头结束）。
function parseVars(toml: string): Record<string, string> {
  const out: Record<string, string> = {};
  let inVars = false;
  for (const line of toml.split("\n")) {
    const t = line.trim();
    if (t.startsWith("[")) {
      inVars = t === "[vars]";
      continue;
    }
    if (!inVars || !t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('"')) {
      const end = v.indexOf('"', 1);
      v = end > 0 ? v.slice(1, end) : v.slice(1);
    } else {
      const h = v.indexOf("#");
      if (h >= 0) v = v.slice(0, h).trim();
    }
    out[m[1]] = v;
  }
  return out;
}

// 在 [vars] 段内更新已有键、追加新键；若无 [vars] 段则新建。保留注释与其它段落。
function setVars(toml: string, vars: Record<string, string>): string {
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

// 可选 worker 目录列表（相对 WORKER_ROOT）+ wrangler name + 当前默认
deploy.get("/workers", (c) => {
  const workers = listWorkers().map((rel) => {
    const abs = path.resolve(workerRoot, rel === "." ? workerRoot : path.join(workerRoot, rel));
    const toml = readToml(abs);
    return {
      dir: rel,
      script_name: toml ? parseName(toml) : null,
    };
  });
  return c.json({
    root: workerRoot,
    default: path.relative(workerRoot, workerDir) || ".",
    workers,
  });
});

// CF 账号下已部署的 Worker 脚本列表
deploy.get("/cf-deployed", async (c) => {
  const r = await listCfDeployedWorkers(Boolean(env.CF_API_TOKEN));
  return c.json(r);
});

// wrangler 可用性、登录态、worker 名、当前 [vars]、私密配置清单与本地状态
deploy.get("/status", async (c) => {
  const dir = resolveWorkerDir(c.req.query("dir"));
  if (dir === null) return c.json({ error: "无效的 worker 目录" }, 400);
  const toml = readToml(dir);
  const example = readFileSafe(devVarsExamplePath(dir));
  const devvars = readFileSafe(devVarsPath(dir));
  const ver = await runWrangler(["--version"], { cwd: dir });
  const who = await runWrangler(["whoami"], { cwd: dir });
  const devVars = devvars ? parseDevVars(devvars) : {};
  const worker_name = toml ? parseName(toml) : null;

  let cf_match: {
    matched: boolean;
    script_name: string | null;
    url: string | null;
    subdomain_enabled: boolean;
    error?: string;
  } | null = null;

  if (worker_name && env.CF_API_TOKEN) {
    const cf = await resolveWorkerFromCf(worker_name, true);
    cf_match = {
      matched: cf.ok,
      script_name: worker_name,
      url: cf.url,
      subdomain_enabled: cf.subdomain_enabled,
      error: cf.ok ? undefined : cf.error,
    };
  }

  return c.json({
    worker_dir: dir,
    worker_dir_rel: path.relative(workerRoot, dir) || ".",
    worker_dir_exists: toml !== null,
    worker_name,
    compatibility_date: toml ? parseCompatibilityDate(toml) : null,
    vars: toml ? parseVars(toml) : {},
    secrets: example ? parseSecretManifest(example) : [],
    dev_vars: devVars,
    local_secrets: Object.keys(devVars),
    has_dev_vars: devvars !== null,
    wrangler_version: ver.code === 0 ? ver.output.trim() : null,
    wrangler_error: ver.code === 0 ? null : ver.output.trim(),
    logged_in: who.code === 0,
    whoami: who.output.trim(),
    cf_match,
  });
});

// 生产已设置的 secret 名（wrangler secret list）。值无法读回，只返回名字。
deploy.get("/secrets", async (c) => {
  const dir = resolveWorkerDir(c.req.query("dir"));
  if (dir === null) return c.json({ error: "无效的 worker 目录" }, 400);
  const r = await runWrangler(["secret", "list"], { cwd: dir });
  if (r.code !== 0) {
    return c.json({ ok: false, names: [], error: r.output.trim() }, 200);
  }
  let names: string[] = [];
  try {
    const start = r.output.indexOf("[");
    const json = start >= 0 ? r.output.slice(start) : r.output;
    const arr = JSON.parse(json) as Array<{ name?: string }>;
    names = arr.map((x) => x.name).filter((n): n is string => typeof n === "string");
  } catch {
    /* 解析失败时返回空，不阻断 UI */
  }
  return c.json({ ok: true, names });
});

// 设置生产 Worker secret（名为合法标识符，值经 stdin 不进命令行）
deploy.post("/secret", async (c) => {
  const dir = resolveWorkerDir(c.req.query("dir"));
  if (dir === null) return c.json({ error: "无效的 worker 目录" }, 400);
  const parsed = secretSet.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: zodMessage(parsed.error) }, 400);
  const { name, value } = parsed.data;
  const r = await runWrangler(["secret", "put", name], { input: value, cwd: dir });
  return c.json({ ok: r.code === 0, code: r.code, output: r.output }, r.code === 0 ? 200 : 400);
});

// 写入本地 .dev.vars（仅供 wrangler dev；生产请用 /secret）
deploy.put("/devvars", async (c) => {
  const dir = resolveWorkerDir(c.req.query("dir"));
  if (dir === null) return c.json({ error: "无效的 worker 目录" }, 400);
  const parsed = devVarsUpdate.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: zodMessage(parsed.error) }, 400);
  const file = devVarsPath(dir);
  const next = setDevVars(readFileSafe(file) ?? "", parsed.data.secrets);
  try {
    fs.writeFileSync(file, next, { mode: 0o600 });
  } catch (e) {
    return c.json({ error: `写入 .dev.vars 失败: ${(e as Error).message}` }, 500);
  }
  return c.json({ ok: true, dev_vars: parseDevVars(next), local_secrets: parseLocalSecretNames(next) });
});

// 更新 wrangler.toml 的 [vars]（通用：任意键值，存在则改、不存在则插入）
deploy.put("/config", async (c) => {
  const dir = resolveWorkerDir(c.req.query("dir"));
  if (dir === null) return c.json({ error: "无效的 worker 目录" }, 400);
  const parsed = workerVarsUpdate.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: zodMessage(parsed.error) }, 400);
  const file = tomlPath(dir);
  const toml = readToml(dir);
  if (toml === null) {
    return c.json({ error: "读取 wrangler.toml 失败（文件不存在？）" }, 500);
  }
  const next = setVars(toml, parsed.data.vars);
  try {
    fs.writeFileSync(file, next);
  } catch (e) {
    return c.json({ error: `写入失败: ${(e as Error).message}` }, 500);
  }
  return c.json({ ok: true, vars: parseVars(next) });
});

deploy.get("/dev/status", async (c) => {
  const dir = resolveWorkerDir(c.req.query("dir"));
  if (dir === null) return c.json({ error: "无效的 worker 目录" }, 400);
  const proc = getWorkerDevProcessStatus();
  const healthy = await probeLocalWorkerHealth();
  return c.json({ ...proc, healthy, worker_dir: dir });
});

deploy.post("/dev/start", async (c) => {
  const dir = resolveWorkerDir(c.req.query("dir"));
  if (dir === null) return c.json({ error: "无效的 worker 目录" }, 400);
  const result = await startWorkerDev(dir);
  if (!result.ok) return c.json({ error: result.error }, 500);
  return c.json({ ok: true, already_running: result.already_running });
});

// Workers Builds（GitHub CI）：状态、同步 monorepo 配置、手动触发构建
deploy.get("/builds/status", async (c) => {
  const dir = resolveWorkerDir(c.req.query("dir"));
  if (dir === null) return c.json({ error: "无效的 worker 目录" }, 400);
  const toml = readToml(dir);
  const worker_name = toml ? parseName(toml) : null;
  const status = await getWorkerBuildsStatus(dir, worker_name);
  return c.json(status, status.ok ? 200 : 200);
});

deploy.post("/builds/sync", async (c) => {
  const dir = resolveWorkerDir(c.req.query("dir"));
  if (dir === null) return c.json({ error: "无效的 worker 目录" }, 400);
  const toml = readToml(dir);
  const worker_name = toml ? parseName(toml) : null;
  const result = await syncWorkerBuildsConfig(dir, worker_name);
  if (!result.ok) return c.json({ ok: false, error: result.error }, 400);
  return c.json(result);
});

deploy.post("/builds/trigger", async (c) => {
  const dir = resolveWorkerDir(c.req.query("dir"));
  if (dir === null) return c.json({ error: "无效的 worker 目录" }, 400);
  const body = (await c.req.json().catch(() => ({}))) as { branch?: string };
  const branch = typeof body.branch === "string" && body.branch.trim() ? body.branch.trim() : "main";
  const toml = readToml(dir);
  const worker_name = toml ? parseName(toml) : null;
  const result = await triggerWorkerBuild(dir, worker_name, branch);
  if (!result.ok) return c.json({ ok: false, error: result.error }, 400);
  return c.json(result);
});

deploy.put("/builds/token", async (c) => {
  const parsed = workerBuilderTokenSet.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: zodMessage(parsed.error) }, 400);

  const check = await validateWorkerBuilderToken(parsed.data.token);
  if (!check.ok) return c.json({ error: check.error }, 400);

  if (!setEnvFileValue("CF_WORKER_BUILDER", parsed.data.token.trim())) {
    return c.json({ error: "写入 admin/.env 失败" }, 500);
  }
  reloadEnv({ quiet: true });
  return c.json({ ok: true, token_configured: true });
});

// 部署 Worker：SSE 实时回传 wrangler deploy 日志
deploy.post("/deploy", (c) => {
  const dir = resolveWorkerDir(c.req.query("dir"));
  if (dir === null) return c.json({ error: "无效的 worker 目录" }, 400);
  return streamSSE(c, async (stream) => {
    await stream.writeSSE({ data: `▶ wrangler deploy 启动中 (${path.relative(workerRoot, dir) || "."}) ...` });
    const child = spawnWrangler(["deploy"], dir);
    const pump = (buf: Buffer) => {
      for (const line of buf.toString().split("\n")) {
        if (line.length) void stream.writeSSE({ data: line });
      }
    };
    child.stdout.on("data", pump);
    child.stderr.on("data", pump);
    await new Promise<void>((resolve) => {
      child.on("error", async (e) => {
        await stream.writeSSE({ event: "error", data: e.message });
        resolve();
      });
      child.on("close", async (code) => {
        await stream.writeSSE({ event: "done", data: String(code ?? -1) });
        resolve();
      });
    });
  });
});
