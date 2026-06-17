import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { env } from "../env";
import { gatewayUrl } from "../cf";
import { loadCfLists, resolveDefaults, RESPONSES_API_PATH } from "../cf-resolve";

// 本地调试用的聊天代理：浏览器 -> 本服务 -> AI Gateway -> 阿里云 MaaS。
export const chat = new Hono();

chat.post("/", async (c) => {
  const payload = (await c.req.json().catch(() => ({}))) as {
    model?: string;
    messages?: unknown;
    input?: unknown;
    gateway?: unknown;
    provider_slug?: unknown;
  };

  if (!env.DASHSCOPE_API_KEY) {
    return c.json(
      { error: "聊天功能需要在 admin/.env 配置 DASHSCOPE_API_KEY" },
      400,
    );
  }

  const { gateways, providers } = await loadCfLists();
  const gatewayOverride =
    typeof payload.gateway === "string" && payload.gateway.trim()
      ? payload.gateway.trim()
      : undefined;
  const slugOverride =
    typeof payload.provider_slug === "string" && payload.provider_slug.trim()
      ? payload.provider_slug.trim()
      : undefined;

  const { gateway, provider } = resolveDefaults(gateways, providers, {
    gatewayId: gatewayOverride,
    providerSlug: slugOverride,
  });

  if (!gateway?.id) {
    return c.json({ error: "CF 上暂无可用网关，请先创建 AI Gateway" }, 400);
  }
  if (!provider?.slug) {
    return c.json({ error: "CF 上暂无已启用的自定义提供商" }, 400);
  }

  const url = gatewayUrl(gateway.id, provider.slug, RESPONSES_API_PATH);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
  };
  if (env.CF_AIG_TOKEN) headers["cf-aig-authorization"] = `Bearer ${env.CF_AIG_TOKEN}`;

  const upstreamBody = JSON.stringify({
    model: payload.model || env.MODEL,
    input: payload.messages || payload.input || [],
    stream: true,
  });

  let upstream: Response;
  try {
    upstream = await fetch(url, { method: "POST", headers, body: upstreamBody });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }

  const ct = upstream.headers.get("content-type") || "";
  if (!upstream.ok || !ct.includes("text/event-stream")) {
    const text = await upstream.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    const err =
      parsed && typeof parsed === "object" && "error" in parsed
        ? (parsed as { error: unknown }).error
        : parsed;
    const status =
      upstream.status >= 400 && upstream.status <= 599 ? upstream.status : 502;
    return c.json({ error: err }, status as ContentfulStatusCode);
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
});
