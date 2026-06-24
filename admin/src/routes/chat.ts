import { Hono } from "hono";
import { gatewayUrl } from "../cf";
import { env } from "../env";
import { loadCfLists, resolveDefaults, CHAT_API_PATH } from "../cf-resolve";
import { normalizeChatMessages, postUpstreamStream, upstreamFetchError } from "../llm-forward";
import { proxyUpstreamChat } from "../sse-proxy";

// 本地调试：浏览器 -> Admin（fetch 透传 SSE）-> AI Gateway -> 阿里云 MaaS。
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

  const messages = normalizeChatMessages(payload.messages ?? payload.input);
  if (!messages.length) {
    return c.json({ error: "messages required" }, 400);
  }

  const url = gatewayUrl(gateway.id, provider.slug, CHAT_API_PATH);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
  };
  if (env.CF_AIG_TOKEN) headers["cf-aig-authorization"] = `Bearer ${env.CF_AIG_TOKEN}`;

  const upstreamBody = {
    model: payload.model || env.MODEL,
    messages,
    stream: true,
  };

  let upstream: Response;
  try {
    upstream = await postUpstreamStream(url, headers, upstreamBody);
  } catch (e) {
    return c.json({ error: upstreamFetchError(e, url) }, 502);
  }

  return proxyUpstreamChat(c, upstream);
});
