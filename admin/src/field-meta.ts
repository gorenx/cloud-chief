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
    gateway: { source: "cf", hint: "Cloudflare AI Gateway id" },
    "routing.model": { source: "catalog", hint: "model-catalog.ts 中的模型 id" },
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
        source: "catalog",
        hint: "model-catalog.ts 中的模型 id",
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
      models: { source: "catalog", hint: "src/model-catalog.ts" },
      "chat.authorization": {
        source: "env",
        key: "DASHSCOPE_API_KEY",
        hint: "POST /api/chat 上游 Bearer（不经 BYOK）",
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
