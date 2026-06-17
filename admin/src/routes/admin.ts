import { Hono } from "hono";
import { adminAuth } from "../auth";
import { cfApi } from "../cf";
import { env } from "../env";
import { buildRouting, modelMetaFor } from "../routing";
import type { ProviderInfo } from "../routing";
import {
  gatewayUpsert,
  providerUpsert,
  keyCreate,
  zodMessage,
} from "../schemas";

export const admin = new Hono();

admin.use("*", adminAuth);

// 账号信息 + .env 默认值 + 网关/提供商列表
admin.get("/state", async (c) => {
  const [gws, provs] = await Promise.all([
    cfApi("GET", "/ai-gateway/gateways?per_page=50"),
    cfApi("GET", "/ai-gateway/custom-providers?per_page=100"),
  ]);
  return c.json({
    account_id: env.CF_ACCOUNT_ID,
    has_api_token: Boolean(env.CF_API_TOKEN),
    defaults: {
      gateway: env.CF_GATEWAY_ID,
      provider_slug: env.PROVIDER_SLUG,
      base_url: env.PROVIDER_BASE_URL,
      path: env.PROVIDER_PATH,
      model: env.MODEL,
    },
    gateways: gws.json.result || [],
    gateways_error: gws.json.success ? null : gws.json.errors,
    providers: provs.json.result || [],
    providers_error: provs.json.success ? null : provs.json.errors,
  });
});

// 网关上下文：聚合路由链、BYOK 密钥、模型元数据
admin.get("/gateways/:id/context", async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "缺少网关 id" }, 400);

  const [gwRes, provRes, keysRes] = await Promise.all([
    cfApi("GET", `/ai-gateway/gateways/${id}`),
    cfApi("GET", "/ai-gateway/custom-providers?per_page=100"),
    cfApi("GET", `/ai-gateway/gateways/${id}/provider_configs?per_page=100`),
  ]);

  const providers = (provsRes(provRes) ?? []) as ProviderInfo[];
  const gateway = gwRes.json.success ? gwRes.json.result : null;
  const routing = buildRouting(id, providers);
  const keys = keysRes.json.success ? keysRes.json.result ?? [] : [];
  const model_meta = modelMetaFor(routing.model);

  return c.json({
    gateway,
    gateway_error: gwRes.json.success ? null : gwRes.json.errors,
    routing,
    keys,
    keys_error: keysRes.json.success ? null : keysRes.json.errors,
    model_meta,
  });
});

function provsRes(r: Awaited<ReturnType<typeof cfApi>>): unknown[] | null {
  return r.json.success && Array.isArray(r.json.result) ? r.json.result : null;
}

// 网关：创建/更新（upsert）
admin.post("/gateways", async (c) => {
  const parsed = gatewayUpsert.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: zodMessage(parsed.error) }, 400);
  const { id, authentication } = parsed.data;
  const payload = {
    cache_ttl: 0,
    collect_logs: true,
    cache_invalidate_on_update: false,
    authentication,
    rate_limiting_interval: 0,
    rate_limiting_limit: 0,
    rate_limiting_technique: "sliding",
  };
  const exists = await cfApi("GET", `/ai-gateway/gateways/${id}`);
  const r = exists.json.success
    ? await cfApi("PUT", `/ai-gateway/gateways/${id}`, payload)
    : await cfApi("POST", "/ai-gateway/gateways", { id, ...payload });
  return c.json(r.json, r.json.success ? 200 : 400);
});

admin.delete("/gateways", async (c) => {
  const id = c.req.query("id");
  if (!id) return c.json({ error: "缺少 id" }, 400);
  const r = await cfApi("DELETE", `/ai-gateway/gateways/${id}`);
  return c.json(r.json, r.json.success ? 200 : 400);
});

// 自定义提供商：创建/更新/删除
admin.post("/providers", async (c) => {
  const parsed = providerUpsert.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: zodMessage(parsed.error) }, 400);
  const b = parsed.data;
  const payload = {
    name: b.name || b.slug,
    slug: b.slug,
    base_url: b.base_url,
    description: b.description || "",
    enable: b.enable !== false,
  };
  const r = b.id
    ? await cfApi("PATCH", `/ai-gateway/custom-providers/${b.id}`, payload)
    : await cfApi("POST", "/ai-gateway/custom-providers", payload);
  return c.json(r.json, r.json.success ? 200 : 400);
});

admin.delete("/providers", async (c) => {
  const id = c.req.query("id");
  if (!id) return c.json({ error: "缺少 id" }, 400);
  const r = await cfApi("DELETE", `/ai-gateway/custom-providers/${id}`);
  return c.json(r.json, r.json.success ? 200 : 400);
});

// BYOK 存储密钥（provider_configs）：列表/创建/删除
admin.get("/keys", async (c) => {
  const gw = c.req.query("gateway");
  if (!gw) return c.json({ error: "缺少 gateway" }, 400);
  const r = await cfApi(
    "GET",
    `/ai-gateway/gateways/${gw}/provider_configs?per_page=100`,
  );
  return c.json(r.json, r.json.success ? 200 : 400);
});

admin.post("/keys", async (c) => {
  const parsed = keyCreate.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: zodMessage(parsed.error) }, 400);
  const b = parsed.data;
  const payload = {
    provider_slug: b.provider_slug,
    alias: b.alias || "default",
    default_config: b.default_config,
    secret: b.secret,
  };
  const r = await cfApi(
    "POST",
    `/ai-gateway/gateways/${b.gateway}/provider_configs`,
    payload,
  );
  return c.json(r.json, r.json.success ? 200 : 400);
});

admin.delete("/keys", async (c) => {
  const gw = c.req.query("gateway");
  const id = c.req.query("id");
  if (!gw || !id) return c.json({ error: "缺少 gateway 或 id" }, 400);
  const r = await cfApi(
    "DELETE",
    `/ai-gateway/gateways/${gw}/provider_configs/${id}`,
  );
  return c.json(r.json, r.json.success ? 200 : 400);
});
