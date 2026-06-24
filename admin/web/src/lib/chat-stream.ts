/** 解析 Chat Completions / Responses API 的 SSE 流 */
import type { TranslateFn } from "../i18n";

export class ChatStreamError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super("ChatStreamError");
    this.name = "ChatStreamError";
  }
}

const DEFAULT_STREAM_TIMEOUT_MS = 120_000;

function appendDelta(
  ev: Record<string, unknown>,
  acc: string,
  onDelta: (text: string) => void,
): string {
  // Chat Completions: choices[0].delta.content
  const choices = ev.choices as Array<{ delta?: { content?: string } }> | undefined;
  const chatDelta = choices?.[0]?.delta?.content;
  if (chatDelta) {
    const next = acc + chatDelta;
    onDelta(next);
    return next;
  }

  // Responses API: response.output_text.delta
  if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") {
    const next = acc + ev.delta;
    onDelta(next);
    return next;
  }

  return acc;
}

export async function streamChatResponse(
  resp: Response,
  onDelta: (text: string) => void,
  t: TranslateFn,
  opts?: { timeoutMs?: number; onResponseId?: (id: string) => void },
): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_STREAM_TIMEOUT_MS;
  const onResponseId = opts?.onResponseId;
  const ctype = resp.headers.get("content-type") ?? "";
  if (!resp.ok || !ctype.includes("text/event-stream")) {
    const j = await resp.json().catch(() => null);
    throw new ChatStreamError(resp.status, j);
  }

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let acc = "";
  let buffer = "";
  const deadline = Date.now() + timeoutMs;

  try {
    while (true) {
      if (Date.now() > deadline) {
        throw new Error("stream timeout");
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const s = line.trim();
        if (!s.startsWith("data:")) continue;
        const data = s.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const ev = JSON.parse(data) as Record<string, unknown>;
          if (ev.type === "response.failed" || ev.error) {
            throw new ChatStreamError(502, ev.error ?? ev);
          }
          if (ev.type === "response.completed" && onResponseId) {
            const response = ev.response as { id?: string } | undefined;
            if (response?.id) onResponseId(response.id);
          }
          acc = appendDelta(ev, acc, onDelta);
        } catch (e) {
          if (e instanceof ChatStreamError) throw e;
          /* ignore malformed chunk */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return acc || t("playground.noContent");
}
