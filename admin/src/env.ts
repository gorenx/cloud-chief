import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const adminRoot = path.resolve(here, ".."); // admin/
export const envFilePath = path.join(adminRoot, ".env");

const schema = z.object({
  CF_ACCOUNT_ID: z.string().min(1, "缺少 CF_ACCOUNT_ID"),
  CF_API_TOKEN: z.string().default(""),
  CF_AIG_TOKEN: z.string().default(""),
  DASHSCOPE_API_KEY: z.string().default(""),
  MODEL: z.string().default("qwen3-max"),
  /** Playground 模型下拉：逗号分隔 id；留空则展示 model-catalog.ts 全部条目 */
  MODEL_CATALOG: z.string().default(""),
  ADMIN_TOKEN: z.string().default(""),
  ADMIN_BIND: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().positive().default(8787),
  CLOUDFLARE_API_TOKEN: z.string().default(""),
  WORKER_DIR: z.string().default("../worker"),
  WORKER_ROOT: z.string().default(".."),
  WORKER_URL: z.string().default("http://127.0.0.1:8788"),
  SUPABASE_ANON_KEY: z.string().default(""),
  SUPABASE_TEST_EMAIL: z.string().default(""),
  SUPABASE_TEST_PASSWORD: z.string().default(""),
});

export type AppEnv = z.infer<typeof schema>;

/** 解析 .env 文本为键值对（供热重载与测试使用） */
export function parseEnvFileContent(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    if (line.trim().startsWith("#")) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

/** 更新 admin/.env 中已有键的值；不存在则追加到文件末尾 */
export function setEnvFileValue(key: string, value: string): boolean {
  if (process.env.VITEST) return false;
  if (!fs.existsSync(envFilePath)) return false;

  const text = fs.readFileSync(envFilePath, "utf8");
  const lines = text.split("\n");
  const keyRe = new RegExp(`^\\s*${key}\\s*=`);
  const newLine = `${key}=${value}`;
  let found = false;
  const next = lines
    .map((line) => {
      if (!keyRe.test(line)) return line;
      found = true;
      return newLine;
    })
    .join("\n");

  const out = found ? next : (text.endsWith("\n") ? text : `${text}\n`) + `${newLine}\n`;
  fs.writeFileSync(envFilePath, out);
  return true;
}

function readEnvFileMap(): Record<string, string> | null {
  if (!fs.existsSync(envFilePath)) return null;
  return parseEnvFileContent(fs.readFileSync(envFilePath, "utf8"));
}

/** 将 .env 条目写入 process.env；force 时覆盖已有值（热重载用） */
function applyEnvMap(fromFile: Record<string, string>, force: boolean): void {
  for (const [k, v] of Object.entries(fromFile)) {
    if (force || process.env[k] === undefined) process.env[k] = v;
  }
}

function resolveWorkerDir(e: AppEnv): string {
  return path.isAbsolute(e.WORKER_DIR) ? e.WORKER_DIR : path.resolve(adminRoot, e.WORKER_DIR);
}

function resolveWorkerRoot(e: AppEnv): string {
  return path.isAbsolute(e.WORKER_ROOT) ? e.WORKER_ROOT : path.resolve(adminRoot, e.WORKER_ROOT);
}

function parseProcessEnv(): AppEnv {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(msg);
  }
  return parsed.data;
}

/** 可变 env 对象；各模块 import 后读取字段即可获得最新值 */
export const env: AppEnv = {} as AppEnv;

export let workerDir = resolveWorkerDir({ WORKER_DIR: "../worker" } as AppEnv);
export let workerRoot = resolveWorkerRoot({ WORKER_ROOT: ".." } as AppEnv);

export const publicDir = path.join(adminRoot, "public");

function syncDerived(): void {
  workerDir = resolveWorkerDir(env);
  workerRoot = resolveWorkerRoot(env);
}

export type ReloadResult =
  | { ok: true; changed: string[] }
  | { ok: false; error: string; keptPrevious: boolean };

/** 从磁盘重载 admin/.env；校验失败时保留上一份配置 */
export function reloadEnv(options: { force?: boolean; quiet?: boolean } = {}): ReloadResult {
  const force = options.force ?? true;
  const fromFile = readEnvFileMap();
  if (!fromFile) {
    return { ok: false, error: "admin/.env 不存在", keptPrevious: true };
  }

  const prev = { ...env };
  const snap: Record<string, string | undefined> = {};
  for (const k of Object.keys(fromFile)) snap[k] = process.env[k];
  applyEnvMap(fromFile, force);

  try {
    const next = parseProcessEnv();
    const changed = (Object.keys(next) as (keyof AppEnv)[]).filter((k) => prev[k] !== next[k]);
    Object.assign(env, next);
    syncDerived();

    if (!options.quiet && changed.length > 0) {
      console.log(`🔄 admin/.env 已重载: ${changed.join(", ")}`);
      if (changed.includes("PORT") || changed.includes("ADMIN_BIND")) {
        console.log("   ⚠️  PORT / ADMIN_BIND 变更需重启进程后监听地址才会生效");
      }
    }
    return { ok: true, changed };
  } catch (e) {
    for (const [k, v] of Object.entries(snap)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    Object.assign(env, prev);
    syncDerived();
    return { ok: false, error: (e as Error).message, keptPrevious: true };
  }
}

function bootstrap(): void {
  const fromFile = readEnvFileMap();
  if (fromFile) applyEnvMap(fromFile, false);

  try {
    Object.assign(env, parseProcessEnv());
    syncDerived();
  } catch (e) {
    console.error("❌ 环境变量校验失败：", (e as Error).message);
    process.exit(1);
  }
}

bootstrap();

let watchTimer: ReturnType<typeof setTimeout> | undefined;

/** 监听 admin/.env 变更并热重载（测试环境不启用） */
export function startEnvWatcher(): void {
  if (process.env.VITEST) return;
  if (!fs.existsSync(envFilePath)) return;

  fs.watch(envFilePath, (event) => {
    if (event !== "change" && event !== "rename") return;
    clearTimeout(watchTimer);
    watchTimer = setTimeout(() => {
      const r = reloadEnv();
      if (!r.ok && r.keptPrevious) {
        console.error(`⚠️  admin/.env 重载失败，仍使用上一份配置: ${r.error}`);
      }
    }, 200);
  });
}

startEnvWatcher();
