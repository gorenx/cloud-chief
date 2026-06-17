import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const adminRoot = path.resolve(here, ".."); // admin/

// 仅加载 admin/.env（与 Worker 的 wrangler.toml / .dev.vars 分离）。
// 已存在的 process.env 永远最高（便于 CI / 容器注入）。
function loadEnvFile(file: string): void {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (line.trim().startsWith("#")) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
loadEnvFile(path.join(adminRoot, ".env"));

const schema = z.object({
  CF_ACCOUNT_ID: z.string().min(1, "缺少 CF_ACCOUNT_ID"),
  CF_API_TOKEN: z.string().default(""),
  CF_AIG_TOKEN: z.string().default(""),
  DASHSCOPE_API_KEY: z.string().default(""),
  MODEL: z.string().default("qwen3-max"),
  ADMIN_TOKEN: z.string().default(""),
  ADMIN_BIND: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().positive().default(8787),
  CLOUDFLARE_API_TOKEN: z.string().default(""),
  WORKER_DIR: z.string().default("../worker"),
  // 可选 worker 目录的白名单根。部署面板只允许选择此目录下的 worker 项目。
  WORKER_ROOT: z.string().default(".."),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ 环境变量校验失败：");
  for (const issue of parsed.error.issues) {
    console.error("  -", issue.path.join("."), issue.message);
  }
  process.exit(1);
}

export const env = parsed.data;
export type AppEnv = typeof env;

export const workerDir = path.isAbsolute(env.WORKER_DIR)
  ? env.WORKER_DIR
  : path.resolve(adminRoot, env.WORKER_DIR);

export const workerRoot = path.isAbsolute(env.WORKER_ROOT)
  ? env.WORKER_ROOT
  : path.resolve(adminRoot, env.WORKER_ROOT);

export const publicDir = path.join(adminRoot, "public");
