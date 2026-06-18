/** 解析 Responses API SSE（response.output_text.delta） */
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

export async function streamChatResponse(
  resp: Response,
  onDelta: (text: string) => void,
  t: TranslateFn,
): Promise<string> {
  const ctype = resp.headers.get("content-type") ?? "";
  if (!resp.ok || !ctype.includes("text/event-stream")) {
    const j = await resp.json().catch(() => null);
    throw new ChatStreamError(resp.status, j);
  }

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let acc = "";
  let buffer = "";

  while (true) {
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
        const ev = JSON.parse(data) as { type?: string; delta?: string };
        if (ev.type === "response.output_text.delta" && ev.delta) {
          acc += ev.delta;
          onDelta(acc);
        }
      } catch {
        /* ignore */
      }
    }
  }
  return acc || t("playground.noContent");
}
