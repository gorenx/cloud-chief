import { Hono } from "hono";
import { z } from "zod";
import { env } from "../env";
import { loadCfLists } from "../cf-resolve";
import {
  buildGatewayPathEntries,
  CHAT_API_PATH,
  RESPONSES_API_PATH,
  type GatewayPathEntry,
} from "../gateway-paths";
import {
  getGatewayApiPathConfig,
  setGatewayApiPathConfig,
} from "../gateway-api-path-config";

const putBody = z.object({
  provider_slug: z.string().min(1, "provider_slug required"),
  chat_suffix: z.string().optional(),
  responses_suffix: z.string().optional(),
  custom_paths: z.array(z.string()).default([]),
});

export const gatewayApiPaths = new Hono();

gatewayApiPaths.get("/:gatewayId/api-paths", async (c) => {
  const gatewayId = c.req.param("gatewayId");
  const providerSlug = c.req.query("provider_slug")?.trim() ?? "";
  if (!gatewayId) return c.json({ error: "缺少网关 id" }, 400);
  if (!providerSlug) return c.json({ error: "缺少 provider_slug 查询参数" }, 400);

  const { providers } = await loadCfLists();
  const provider = providers.find((p) => p.slug === providerSlug) ?? null;
  const config = getGatewayApiPathConfig(gatewayId, providerSlug);
  const paths = buildGatewayPathEntries({
    accountId: env.CF_ACCOUNT_ID,
    gatewayId,
    providerSlug,
    providerBaseUrl: provider?.base_url,
    chatSuffix: config.chat_suffix,
    responsesSuffix: config.responses_suffix,
    customSuffixes: config.custom_paths,
  });

  return c.json({
    gateway_id: gatewayId,
    provider_slug: providerSlug,
    account_id: env.CF_ACCOUNT_ID,
    provider_base_url: provider?.base_url ?? "",
    chat_suffix: config.chat_suffix,
    responses_suffix: config.responses_suffix,
    custom_paths: config.custom_paths,
    paths,
  });
});

gatewayApiPaths.put("/:gatewayId/api-paths", async (c) => {
  const gatewayId = c.req.param("gatewayId");
  if (!gatewayId) return c.json({ error: "缺少网关 id" }, 400);

  const parsed = putBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "invalid body" }, 400);
  }

  const { provider_slug, chat_suffix, responses_suffix, custom_paths } = parsed.data;
  const { providers } = await loadCfLists();
  const provider = providers.find((p) => p.slug === provider_slug);
  if (!provider) {
    return c.json({ error: `未找到提供商 slug: ${provider_slug}` }, 404);
  }

  const saved = setGatewayApiPathConfig(gatewayId, provider_slug, {
    chat_suffix,
    responses_suffix,
    custom_paths,
  });
  const paths = buildGatewayPathEntries({
    accountId: env.CF_ACCOUNT_ID,
    gatewayId,
    providerSlug: provider_slug,
    providerBaseUrl: provider.base_url,
    chatSuffix: saved.chat_suffix,
    responsesSuffix: saved.responses_suffix,
    customSuffixes: saved.custom_paths,
  });

  return c.json({
    gateway_id: gatewayId,
    provider_slug,
    account_id: env.CF_ACCOUNT_ID,
    provider_base_url: provider.base_url,
    chat_suffix: saved.chat_suffix,
    responses_suffix: saved.responses_suffix,
    custom_paths: saved.custom_paths,
    paths,
  });
});

export type GatewayApiPathsResponse = {
  gateway_id: string;
  provider_slug: string;
  account_id: string;
  provider_base_url: string;
  chat_suffix: string;
  responses_suffix: string;
  custom_paths: string[];
  paths: GatewayPathEntry[];
};
