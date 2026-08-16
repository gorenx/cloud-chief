import OpenAI, { APIError } from "openai";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  CHAT_API_PATH,
  normalizeGatewayPathSuffix,
  RESPONSES_API_PATH,
} from "./gateway-paths";
import { gatewayUrlWithAccount } from "./gateway-url";

/**
 * OpenAI SDK 客户端与 Playground Gateway 聊天。
 * Gateway 路径为 /responses 时用 responses.create；/chat/completions 时用 chat.completions。
 * SDK 流统一转为 response.output_text.delta，供前端 chat-stream 解析。
 */

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache",
} as const;

/** CF AI Gateway provider-specific 端点（SDK 会再拼 /chat/completions 或 /responses） */
export function gatewayCompatibleBaseUrl(
  accountId: string,
  gatewayId: string,
  providerSlug: string,
): string {
  return (
    `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}` +
    `/custom-${providerSlug}`
  );
}

export type GatewaySdkRoute =
  | { kind: "chat"; baseURL: string }
  | { kind: "responses"; baseURL: string }
  | { kind: "raw"; url: string };

/** 将 Gateway suffix 映射为 SDK baseURL + API 种类（前缀留在 baseURL，后缀由 SDK 追加） */
export function resolveGatewaySdkRoute(
  accountId: string,
  gatewayId: string,
  providerSlug: string,
  pathSuffix: string,
): GatewaySdkRoute {
  const normalized = normalizeGatewayPathSuffix(pathSuffix) || CHAT_API_PATH;
  const root = gatewayCompatibleBaseUrl(accountId, gatewayId, providerSlug);

  if (normalized.endsWith(CHAT_API_PATH)) {
    const prefix = normalized.slice(0, -CHAT_API_PATH.length);
    return { kind: "chat", baseURL: `${root}${prefix}` };
  }
  if (normalized.endsWith(RESPONSES_API_PATH)) {
    const prefix = normalized.slice(0, -RESPONSES_API_PATH.length);
    return { kind: "responses", baseURL: `${root}${prefix}` };
  }

  return {
    kind: "raw",
    url: gatewayUrlWithAccount(accountId, gatewayId, providerSlug, normalized),
  };
}

export function toOpenAiChatMessages(
  messages: Array<{ role: string; content: string }>,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return messages.map((m) => ({
    role: m.role as "user" | "assistant" | "system" | "developer",
    content: m.content,
  }));
}

/** Responses API input：与 Worker /v1/responses 一致，支持多轮 messages */
export function toResponsesInput(
  messages: Array<{ role: string; content: string }>,
): OpenAI.Responses.ResponseInput {
  return messages.map((m) => ({
    type: "message" as const,
    role:
      m.role === "assistant" || m.role === "system" || m.role === "developer"
        ? m.role
        : "user",
    content: m.content,
  }));
}

/**
 * 百炼 Responses 多轮应使用 previous_response_id，勿把 assistant 历史塞进 input。
 */
export function buildResponsesCreateParams(
  messages: Array<{ role: string; content: string }>,
  previousResponseId?: string,
): { input: string | OpenAI.Responses.ResponseInput; previous_response_id?: string } {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return { input: "" };

  const prev = previousResponseId?.trim();
  if (prev) {
    return { input: lastUser.content, previous_response_id: prev };
  }

  if (messages.length === 1) {
    return { input: lastUser.content };
  }

  return { input: toResponsesInput(messages) };
}

function createHeaderTimeoutFetch(timeoutMs: number): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const outer = init?.signal;
    if (outer) {
      if (outer.aborted) controller.abort();
      else outer.addEventListener("abort", () => controller.abort(), { once: true });
    }
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
}

export function createGatewayOpenAiClient(opts: {
  accountId: string;
  gatewayId: string;
  providerSlug: string;
  apiKey: string;
  cfAigToken?: string;
  timeoutMs?: number;
}): OpenAI {
  return createOpenAiClientAtBase({
    baseURL: gatewayCompatibleBaseUrl(opts.accountId, opts.gatewayId, opts.providerSlug),
    apiKey: opts.apiKey,
    cfAigToken: opts.cfAigToken,
    timeoutMs: opts.timeoutMs,
  });
}

export function createOpenAiClientAtBase(opts: {
  baseURL: string;
  apiKey: string;
  cfAigToken?: string;
  timeoutMs?: number;
}): OpenAI {
  const headers: Record<string, string> = {};
  if (opts.cfAigToken) headers["cf-aig-authorization"] = `Bearer ${opts.cfAigToken}`;

  return new OpenAI({
    apiKey: opts.apiKey,
    baseURL: opts.baseURL.replace(/\/+$/, ""),
    defaultHeaders: headers,
    maxRetries: 0,
    fetch: opts.timeoutMs ? createHeaderTimeoutFetch(opts.timeoutMs) : undefined,
  });
}

/** Playground：OpenAI SDK 把 Worker 当作 compatible-mode 端点 */
export function createWorkerOpenAiClient(baseUrl: string, accessToken: string): OpenAI {
  const root = baseUrl.replace(/\/$/, "");
  return new OpenAI({
    apiKey: accessToken,
    baseURL: `${root}/v1`,
    maxRetries: 0,
    fetch: createHeaderTimeoutFetch(15_000),
  });
}

function sseFromEvents(events: AsyncIterable<Record<string, unknown>>): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of events) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
        controller.close();
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "response.failed", error: { message } })}\n\n`,
            ),
          );
          controller.close();
        } catch {
          /* client already disconnected */
        }
      }
    },
  });
  return new Response(body, { status: 200, headers: SSE_HEADERS });
}

/** Responses API 流 → Playground 消费的 SSE（response.output_text.delta） */
export function responsesStreamToResponse(
  stream: AsyncIterable<ResponseStreamEvent>,
): Response {
  return sseFromEvents(stream as AsyncIterable<Record<string, unknown>>);
}

/** Chat Completions 流 → 同样形状的 delta 事件，供现有 chat-stream 解析 */
export async function streamChatAsResponses(
  client: OpenAI,
  params: { model: string; messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] },
): Promise<Response> {
  const stream = await client.chat.completions.create({
    model: params.model,
    messages: params.messages,
    stream: true,
  });

  async function* events(): AsyncIterable<Record<string, unknown>> {
    for await (const chunk of stream as AsyncIterable<ChatCompletionChunk>) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield { type: "response.output_text.delta", delta };
      }
    }
  }

  return sseFromEvents(events());
}

export async function streamResponses(
  client: OpenAI,
  params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    previousResponseId?: string;
  },
): Promise<Response> {
  const { input, previous_response_id } = buildResponsesCreateParams(
    params.messages,
    params.previousResponseId,
  );
  const stream = await client.responses.create({
    model: params.model,
    input,
    ...(previous_response_id ? { previous_response_id } : {}),
    stream: true,
  });
  return responsesStreamToResponse(stream);
}

export function openAiErrorToJson(c: Context, e: unknown): Response {
  if (e instanceof APIError) {
    const err = e.error ?? e.message;
    const status = (e.status && e.status >= 400 && e.status <= 599 ? e.status : 502) as ContentfulStatusCode;
    return c.json({ error: err }, status);
  }
  if (e instanceof Error && e.name === "AbortError") {
    return c.json({ error: "upstream timeout" }, 504);
  }
  return c.json({ error: (e as Error).message }, 502);
}
