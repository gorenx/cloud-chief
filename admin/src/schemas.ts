import { z } from "zod";

export const gatewayUpsert = z.object({
  id: z.string().min(1, "缺少网关 id"),
  authentication: z.boolean().optional().default(false),
});

export const providerUpsert = z.object({
  id: z.string().optional(),
  slug: z.string().min(1, "缺少 slug"),
  base_url: z.string().url("base_url 必须是合法 URL"),
  name: z.string().optional(),
  description: z.string().optional(),
  enable: z.boolean().optional(),
});

export const keyCreate = z.object({
  gateway: z.string().min(1, "缺少 gateway"),
  provider_slug: z.string().min(1, "缺少 provider_slug"),
  alias: z.string().optional().default("default"),
  default_config: z.boolean().optional().default(false),
  secret: z.string().min(1, "缺少密钥值"),
});

// 通用的环境变量/Secret 名校验：大写字母开头，只含大写字母、数字、下划线。
// 作为 wrangler 参数使用，限制字符集可避免越权与异常名。
export const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;
const D1_DATABASE_NAME = /^[A-Za-z0-9_-]{1,64}$/;

export const secretSet = z.object({
  name: z.string().regex(ENV_NAME, "Secret 名需大写字母开头，仅含大写字母/数字/下划线"),
  value: z.string().min(1, "缺少密钥值"),
});

// 通用 worker 变量更新：写入 wrangler.toml 的 [vars]，支持任意键。
export const workerVarsUpdate = z.object({
  vars: z
    .record(
      z.string().regex(ENV_NAME, "变量名需大写字母开头，仅含大写字母/数字/下划线"),
      z.string(),
    )
    .refine((v) => Object.keys(v).length > 0, "至少提供一个变量"),
});

// 私密配置写入本地 .dev.vars（仅供 wrangler dev；生产请用 secret put）。
export const devVarsUpdate = z.object({
  secrets: z
    .record(
      z.string().regex(ENV_NAME, "Secret 名需大写字母开头，仅含大写字母/数字/下划线"),
      z.string(),
    )
    .refine((v) => Object.keys(v).length > 0, "至少提供一个 secret"),
});

export const workerBuilderTokenSet = z.object({
  token: z.string().min(1, "缺少 API Token"),
});

export const d1DatabaseCreate = z.object({
  name: z
    .string()
    .trim()
    .regex(D1_DATABASE_NAME, "数据库名仅支持字母、数字、下划线、连字符，长度 1-64"),
  binding: z
    .string()
    .trim()
    .regex(ENV_NAME, "binding 需大写字母开头，仅含大写字母/数字/下划线")
    .default("DB"),
  update_wrangler: z.boolean().optional().default(true),
  apply_migrations: z.boolean().optional().default(false),
});

export const d1DatabaseBind = z.object({
  database_name: z
    .string()
    .trim()
    .regex(D1_DATABASE_NAME, "数据库名仅支持字母、数字、下划线、连字符，长度 1-64"),
  database_id: z.string().trim().min(1, "缺少 database_id"),
  binding: z
    .string()
    .trim()
    .regex(ENV_NAME, "binding 需大写字母开头，仅含大写字母/数字/下划线")
    .default("DB"),
  apply_migrations: z.boolean().optional().default(false),
});

export function zodMessage(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
}
