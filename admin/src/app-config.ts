import type { AppEnv } from "./env";

export type AppConfigSectionId = "cloudflare" | "playground" | "worker" | "supabase" | "auth";

export interface AppConfigFieldDef {
  key: keyof AppEnv & string;
  section: AppConfigSectionId;
  sensitive?: boolean;
  hint?: string;
}

/** 仅保留在 admin/.env，不写入 SQLite（进程启动前必须可读） */
export const BOOTSTRAP_ENV_KEYS = [
  "ADMIN_DB_PATH",
  "ADMIN_DB_ENCRYPT",
  "ADMIN_DB_ENCRYPTION_KEY",
  "ADMIN_BIND",
  "PORT",
] as const;

export const APP_CONFIG_FIELDS: AppConfigFieldDef[] = [
  { key: "CF_ACCOUNT_ID", section: "cloudflare", hint: "Cloudflare 账号 ID" },
  { key: "CLOUDFLARE_ACCOUNT_ID", section: "cloudflare", hint: "Wrangler 账号 ID（兼容 CF_ACCOUNT_ID）" },
  { key: "CF_API_TOKEN", section: "cloudflare", sensitive: true, hint: "拉取网关/提供商/BYOK" },
  { key: "CF_AIG_TOKEN", section: "cloudflare", sensitive: true, hint: "网关鉴权 cf-aig-authorization" },
  { key: "CLOUDFLARE_API_TOKEN", section: "cloudflare", sensitive: true, hint: "spawn wrangler 时注入" },
  { key: "CF_WORKER_BUILDER", section: "cloudflare", sensitive: true, hint: "Workers Builds / GitHub CI" },
  { key: "DASHSCOPE_API_KEY", section: "playground", sensitive: true, hint: "Playground 直连聊天" },
  { key: "MODEL", section: "playground", hint: "Playground 默认模型 id" },
  { key: "MODEL_CATALOG", section: "playground", hint: "模型下拉，逗号分隔 id" },
  { key: "GATEWAY_CUSTOM_PATHS", section: "playground", hint: "Gateway 额外 API 路径 suffix" },
  { key: "WORKER_URL", section: "worker", hint: "本地 wrangler dev 地址" },
  { key: "WORKER_DIR", section: "worker", hint: "含 wrangler.toml 的 Worker 目录" },
  { key: "WORKER_ROOT", section: "worker", hint: "扫描 Worker 项目的根目录" },
  { key: "SUPABASE_MIGRATIONS_DIR", section: "worker", hint: "相对 WORKER_ROOT 的 SQL 迁移目录" },
  { key: "SUPABASE_FUNCTIONS_DIR", section: "worker", hint: "相对 WORKER_ROOT 的 Edge Functions 目录" },
  { key: "SUPABASE_ANON_KEY", section: "supabase", sensitive: true, hint: "Supabase anon key" },
  { key: "SUPABASE_TEST_EMAIL", section: "supabase", hint: "Playground 测试账号邮箱" },
  { key: "SUPABASE_TEST_PASSWORD", section: "supabase", sensitive: true, hint: "Playground 测试账号密码" },
  { key: "SUPABASE_OAUTH_CLIENT_ID", section: "supabase", hint: "Supabase 平台 OAuth" },
  { key: "SUPABASE_OAUTH_CLIENT_SECRET", section: "supabase", sensitive: true },
  {
    key: "SUPABASE_OAUTH_REDIRECT_URI",
    section: "supabase",
    hint: "OAuth 回调，须与 Supabase 控制台一致",
  },
  { key: "ADMIN_WEB_ORIGIN", section: "auth", hint: "开发模式 Vite origin" },
  { key: "ADMIN_TOKEN", section: "auth", sensitive: true, hint: "脚本/自动化 Bearer token" },
];

export const MIGRATABLE_ENV_KEYS = APP_CONFIG_FIELDS.map((f) => f.key);

const fieldByKey = new Map(APP_CONFIG_FIELDS.map((f) => [f.key, f]));

export function getAppConfigField(key: string): AppConfigFieldDef | undefined {
  return fieldByKey.get(key as keyof AppEnv & string);
}

export function isMigratableEnvKey(key: string): boolean {
  return fieldByKey.has(key as keyof AppEnv & string);
}

export function maskConfigValue(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}…${value.slice(-2)}`;
}

export const APP_CONFIG_SECTION_ORDER: AppConfigSectionId[] = [
  "cloudflare",
  "playground",
  "worker",
  "supabase",
  "auth",
];
