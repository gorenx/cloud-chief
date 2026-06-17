import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** 将上游 SSE 或错误 JSON 转为 Hono 响应 */
export async function proxyUpstreamChat(c: Context, upstream: Response) {
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
}
