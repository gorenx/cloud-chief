import { Hono } from "hono";
import { env } from "../env";
import { loadCfLists, resolveDefaults } from "../cf-resolve";
import { CHAT_API_PATH, normalizeGatewayPathSuffix } from "../gateway-paths";
import { normalizeChatMessages, postUpstreamStream, upstreamFetchError } from "../llm-forward";
import {
  createOpenAiClientAtBase,
  openAiErrorToJson,
  resolveGatewaySdkRoute,
  streamChatAsResponses,
  streamResponses,
  toOpenAiChatMessages,
} from "../openai-llm";
import { proxyUpstreamChat } from "../sse-proxy";

// 本地调试：浏览器 -> Admin（OpenAI SDK 流式）-> AI Gateway -> 上游 MaaS。
export const chat = new Hono();

chat.post("/", async (c) => {
  const payload = (await c.req.json().catch(() => ({}))) as {
    model?: string;
    messages?: unknown;
    input?: unknown;
    gateway?: unknown;
    provider_slug?: unknown;
    path?: unknown;
    previous_response_id?: unknown;
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

  const pathStr =
    normalizeGatewayPathSuffix(typeof payload.path === "string" ? payload.path : CHAT_API_PATH) ||
    CHAT_API_PATH;

  const model = payload.model || env.MODEL;
  const route = resolveGatewaySdkRoute(
    env.CF_ACCOUNT_ID,
    gateway.id,
    provider.slug,
    pathStr,
  );

  if (route.kind === "raw") {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
    };
    if (env.CF_AIG_TOKEN) headers["cf-aig-authorization"] = `Bearer ${env.CF_AIG_TOKEN}`;

    let upstream: Response;
    try {
      upstream = await postUpstreamStream(
        route.url,
        headers,
        { model, messages, stream: true },
      );
    } catch (e) {
      return c.json({ error: upstreamFetchError(e, route.url) }, 502);
    }
    return proxyUpstreamChat(c, upstream);
  }

  try {
    const client = createOpenAiClientAtBase({
      baseURL: route.baseURL,
      apiKey: env.DASHSCOPE_API_KEY,
      cfAigToken: env.CF_AIG_TOKEN || undefined,
    });

    if (route.kind === "responses") {
      const previousResponseId =
        typeof payload.previous_response_id === "string"
          ? payload.previous_response_id.trim()
          : undefined;
      return await streamResponses(client, {
        model,
        messages,
        previousResponseId: previousResponseId || undefined,
      });
    }

    return await streamChatAsResponses(client, {
      model,
      messages: toOpenAiChatMessages(messages),
    });
  } catch (e) {
    return openAiErrorToJson(c, e);
  }
});
