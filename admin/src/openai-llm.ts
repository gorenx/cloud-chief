import OpenAI, { APIError } from "openai";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * OpenAI SDK 客户端与集成测试 helper。
 * 生产聊天流式路径请用 llm-forward.ts（fetch 透传 SSE），避免 SDK 解析导致的中途断流。
 */

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache",
} as const;

/** CF AI Gateway → 百炼 compatible-mode baseURL */
export function gatewayCompatibleBaseUrl(
  accountId: string,
  gatewayId: string,
  providerSlug: string,
): string {
  return (
    `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}` +
    `/custom-${providerSlug}/compatible-mode/v1`
  );
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
  const headers: Record<string, string> = {};
  if (opts.cfAigToken) headers["cf-aig-authorization"] = `Bearer ${opts.cfAigToken}`;

  return new OpenAI({
    apiKey: opts.apiKey,
    baseURL: gatewayCompatibleBaseUrl(opts.accountId, opts.gatewayId, opts.providerSlug),
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
  params: { model: string; input: OpenAI.Responses.ResponseInput },
): Promise<Response> {
  const stream = await client.responses.create({
    model: params.model,
    input: params.input,
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
