import type { Env, UpstreamKind } from "./types";

const PATH_MAP: Record<UpstreamKind, string> = {
  chat: "/compatible-mode/v1/chat/completions",
  responses: "/compatible-mode/v1/responses",
};

export function gatewayUrl(env: Env, kind: UpstreamKind): string {
  return (
    `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}` +
    `/${env.CF_GATEWAY_ID}/custom-${env.PROVIDER_SLUG}${PATH_MAP[kind]}`
  );
}

const DEFAULT_UPSTREAM_TIMEOUT_MS = 60_000;

function jsonError(status: number, error: string, detail?: string): Response {
  return new Response(JSON.stringify({ error, ...(detail ? { detail } : {}) }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/**
 * 注入服务端密钥后转发到 AI Gateway，并把上游响应（含 SSE 流）原样透传回去。
 *
 * 超时策略：只对“等待上游响应头（首字节）”计时；一旦 fetch 解析出响应头，
 * 立刻清除计时器，后续流式输出不再受限——避免误伤正常的长流式生成。
 */
export async function forward(
  env: Env,
  kind: UpstreamKind,
  body: string,
  metadata: Record<string, unknown>,
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
    "cf-aig-metadata": JSON.stringify(metadata),
  };
  if (env.CF_AIG_TOKEN) headers["cf-aig-authorization"] = `Bearer ${env.CF_AIG_TOKEN}`;

  const timeoutMs = Number(env.UPSTREAM_TIMEOUT_MS) || DEFAULT_UPSTREAM_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let upstream: Response;
  try {
    upstream = await fetch(gatewayUrl(env, kind), {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return aborted
      ? jsonError(504, "upstream timeout", `no response headers within ${timeoutMs}ms`)
      : jsonError(502, "upstream fetch failed", (e as Error).message);
  } finally {
    clearTimeout(timer);
  }

  const respHeaders = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) respHeaders.set("content-type", ct);
  respHeaders.set("cache-control", "no-cache");
  return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
}
