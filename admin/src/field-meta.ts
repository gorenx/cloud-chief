export type FieldSource = "env" | "cf" | "wrangler" | "catalog" | "derived";

export interface FieldMetaEntry {
  source: FieldSource;
  key?: string;
  dependsOn?: string[];
  hint?: string;
}

export interface ResponseMeta {
  fields: Record<string, FieldMetaEntry>;
}

const INVOKE_DEPENDS = [
  "CF_ACCOUNT_ID",
  "gatewayId",
  "providerSlug",
  "RESPONSES_API_PATH",
] as const;

/** 路由链各字段的数据来源 */
export function routingFieldsMeta(): Record<string, FieldMetaEntry> {
  return {
    gateway: { source: "cf", hint: "Cloudflare AI Gateway id（Admin 默认解析）" },
    "routing.model": { source: "catalog", hint: "模型 id（元数据见 model-catalog.ts）" },
    "routing.worker_model": {
      source: "wrangler",
      key: "DEFAULT_MODEL",
      hint: "worker/wrangler.toml [vars]",
    },
    "routing.provider_slug": {
      source: "cf",
      hint: "CF 自定义提供商 slug（默认取首个已启用）",
    },
    "routing.provider": {
      source: "cf",
      hint: "GET /ai-gateway/custom-providers",
    },
    "routing.path": {
      source: "derived",
      hint: "Responses API 固定路径 /compatible-mode/v1/responses",
    },
    "routing.base_url": {
      source: "cf",
      hint: "CF 自定义提供商 base_url",
    },
    "routing.invoke_url": {
      source: "derived",
      dependsOn: [...INVOKE_DEPENDS],
      hint: "gatewayUrl(accountId, gatewayId, providerSlug, path)",
    },
    "routing.api_type": {
      source: "derived",
      hint: "固定 responses（本地路由定义）",
    },
    "worker_routing.account_id": {
      source: "wrangler",
      key: "CF_ACCOUNT_ID",
      hint: "worker/wrangler.toml [vars]",
    },
    "worker_routing.gateway": {
      source: "wrangler",
      key: "CF_GATEWAY_ID",
      hint: "worker/wrangler.toml [vars]",
    },
    "worker_routing.provider_slug": {
      source: "wrangler",
      key: "PROVIDER_SLUG",
      hint: "worker/wrangler.toml [vars]",
    },
    "worker_routing.default_model": {
      source: "wrangler",
      key: "DEFAULT_MODEL",
      hint: "worker/wrangler.toml [vars]",
    },
    "worker_routing.provider": {
      source: "cf",
      hint: "按 wrangler PROVIDER_SLUG 匹配 CF 提供商对象",
    },
    "worker_routing.base_url": {
      source: "cf",
      hint: "匹配到的 CF 提供商 base_url",
    },
    "worker_routing.path": {
      source: "derived",
      hint: "Worker 转发 Responses API 固定路径",
    },
    "worker_routing.invoke_url": {
      source: "derived",
      dependsOn: ["CF_ACCOUNT_ID", "CF_GATEWAY_ID", "PROVIDER_SLUG", "RESPONSES_API_PATH"],
      hint: "由 wrangler [vars] 拼接网关 invoke_url",
    },
  };
}

export function configMeta(): ResponseMeta {
  return {
    fields: {
      gateway: {
        source: "cf",
        hint: "默认网关：CF is_default 或列表首项",
      },
      model: {
        source: "env",
        key: "MODEL",
        hint: "Playground 默认模型 id",
      },
      gateways: {
        source: "cf",
        hint: "GET /ai-gateway/gateways",
      },
      provider_slug: {
        source: "cf",
        hint: "默认提供商 slug",
      },
      base_url: {
        source: "cf",
        hint: "默认提供商 base_url",
      },
      path: {
        source: "derived",
        hint: "Responses API 固定路径",
      },
      models: {
        source: "env",
        key: "MODEL_CATALOG",
        hint: "逗号分隔模型 id；元数据见 model-catalog.ts",
      },
      "chat.authorization": {
        source: "env",
        key: "DASHSCOPE_API_KEY",
        hint: "POST /api/chat 上游 Bearer（不经 BYOK）",
      },
      "worker.url": {
        source: "env",
        key: "WORKER_URL",
        hint: "Playground Worker 模式代理目标",
      },
      "worker.supabase_url": {
        source: "wrangler",
        key: "SUPABASE_URL",
        hint: "worker/wrangler.toml [vars]",
      },
      "worker.authorization": {
        source: "derived",
        hint: "Supabase access_token（Admin 代换或请求体传入）",
      },
      ...routingFieldsMeta(),
    },
  };
}

export function gatewayContextMeta(gatewayId: string): ResponseMeta {
  return {
    fields: {
      ...routingFieldsMeta(),
      "gateway.id": { source: "cf", hint: "GET /ai-gateway/gateways/{id}" },
      "gateway.authentication": { source: "cf" },
      "gateway.collect_logs": { source: "cf" },
      "gateway.is_default": {
        source: "cf",
        hint: "CF 控制台标记",
      },
      keys: { source: "cf", hint: "GET .../provider_configs" },
      model_meta: { source: "catalog", hint: "按 routing.model 查找 model-catalog.ts" },
    },
  };
}
