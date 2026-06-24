/** 流式 LLM 请求：fetch 原样透传上游 SSE。 */

const DEFAULT_HEADER_TIMEOUT_MS = 60_000;

/**
 * 仅对「等待上游响应头」计时；拿到响应头后清除，不影响后续流式 body。
 */
export async function postUpstreamStream(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs = DEFAULT_HEADER_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export function upstreamFetchError(e: unknown, url: string): string {
  if (e instanceof Error && e.name === "AbortError") {
    return `upstream timeout waiting for response headers (${url})`;
  }
  return (e as Error).message;
}

/** 统一为 Chat Completions 的 messages 数组 */
export function normalizeChatMessages(raw: unknown): Array<{ role: string; content: string }> {
  if (Array.isArray(raw)) {
    return raw.filter(
      (m): m is { role: string; content: string } =>
        !!m &&
        typeof m === "object" &&
        typeof (m as { role?: unknown }).role === "string" &&
        typeof (m as { content?: unknown }).content === "string",
    );
  }
  if (typeof raw === "string" && raw.trim()) {
    return [{ role: "user", content: raw.trim() }];
  }
  return [];
}
