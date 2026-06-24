import { useRef, useState, type RefObject } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { ChatStreamError, streamChatResponse } from "@/lib/chat-stream";
import { buildChatRequest, isResponsesGatewayPath, type ChatPath, type WorkerTarget } from "@/lib/playground-session";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function usePlaygroundChat(scrollRef: RefObject<HTMLDivElement | null>) {
  const { t } = useLocale();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const historyRef = useRef<ChatMessage[]>([]);
  const lastResponseIdRef = useRef<string | null>(null);
  const requestFailedPrefix = t("playground.requestFailedPrefix");
  const errorPrefix = t("playground.errorPrefix");

  async function send(params: {
    path: ChatPath;
    effectiveModel: string;
    gateway?: string;
    providerSlug?: string;
    gatewayApiPath?: string;
    workerAccessToken: string;
    workerTestEmail?: string;
    workerTestPassword?: string;
    workerTarget?: WorkerTarget;
    workerDir?: string;
    useWorkerToml: boolean;
  }) {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    if (historyRef.current.length === 0) {
      lastResponseIdRef.current = null;
    }

    const useResponsesChain =
      params.path === "gateway" && isResponsesGatewayPath(params.gatewayApiPath);
    const previousResponseId = useResponsesChain ? lastResponseIdRef.current : null;

    const userMsg: ChatMessage = { role: "user", content: text };
    historyRef.current = [...historyRef.current, userMsg];
    setMessages((m) => [...m, userMsg]);

    const assistantIdx = historyRef.current.length;
    setMessages((m) => [...m, { role: "assistant", content: t("playground.thinking") }]);

    const abort = new AbortController();
    const streamTimer = setTimeout(() => abort.abort(), 120_000);

    try {
      const { url, body } = buildChatRequest({
        ...params,
        messages: historyRef.current,
        previousResponseId,
      });
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abort.signal,
      });

      const content = await streamChatResponse(
        resp,
        (acc) => {
          setMessages((m) => {
            const copy = [...m];
            copy[assistantIdx] = { role: "assistant", content: acc };
            return copy;
          });
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
        },
        t,
        {
          onResponseId: useResponsesChain
            ? (id) => {
                lastResponseIdRef.current = id;
              }
            : undefined,
        },
      );

      historyRef.current = [...historyRef.current, { role: "assistant", content }];
      setMessages((m) => {
        const copy = [...m];
        copy[assistantIdx] = { role: "assistant", content };
        return copy;
      });
    } catch (e) {
      if (useResponsesChain) lastResponseIdRef.current = null;
      let errContent: string;
      if (e instanceof ChatStreamError) {
        errContent = `${requestFailedPrefix} (${e.status}): ${JSON.stringify(e.body)}`;
      } else {
        const err = (e as Error).message;
        errContent = err.startsWith(requestFailedPrefix) ? err : `${errorPrefix}: ${err}`;
      }
      setMessages((m) => {
        const copy = [...m];
        copy[assistantIdx] = { role: "assistant", content: errContent };
        return copy;
      });
    } finally {
      clearTimeout(streamTimer);
      setSending(false);
    }
  }

  return { messages, input, setInput, sending, send, errorPrefixes: { requestFailedPrefix, errorPrefix } };
}
