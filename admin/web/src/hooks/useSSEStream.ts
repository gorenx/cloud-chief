import { useCallback, useRef, useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";

export interface SSEEvent {
  event: string;
  data: string;
}

function parseSSEBuffer(buffer: string, onEvent: (e: SSEEvent) => void): string {
  const records = buffer.split("\n\n");
  const rest = records.pop() ?? "";
  for (const rec of records) {
    let ev = "message";
    const data: string[] = [];
    for (const line of rec.split("\n")) {
      if (line.startsWith("event:")) ev = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    onEvent({ event: ev, data: data.join("\n") });
  }
  return rest;
}

export function useSSEStream() {
  const { t } = useLocale();
  const [lines, setLines] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (
      url: string,
      opts: { method?: string; headers?: Record<string, string>; onEvent?: (e: SSEEvent) => void } = {},
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLines([]);
      setRunning(true);

      const requestFailedPrefix = t("playground.requestFailedPrefix");
      const errorPrefix = t("playground.errorPrefix");

      try {
        const resp = await fetch(url, {
          method: opts.method ?? "POST",
          headers: opts.headers,
          signal: controller.signal,
        });

        const ct = resp.headers.get("content-type") ?? "";
        if (!resp.ok || !ct.includes("text/event-stream")) {
          const j = await resp.json().catch(() => null);
          const msg = `${requestFailedPrefix} (${resp.status}): ${JSON.stringify(j)}`;
          setLines([msg]);
          opts.onEvent?.({ event: "error", data: msg });
          return;
        }

        const reader = resp.body!.getReader();
        const dec = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          buf = parseSSEBuffer(buf, (e) => {
            setLines((prev) => [...prev, e.data]);
            opts.onEvent?.(e);
          });
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          const msg = `${errorPrefix}: ${(e as Error).message}`;
          setLines((prev) => [...prev, msg]);
          opts.onEvent?.({ event: "error", data: msg });
        }
      } finally {
        setRunning(false);
      }
    },
    [t],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
  }, []);

  return { lines, running, start, stop, setLines };
}
