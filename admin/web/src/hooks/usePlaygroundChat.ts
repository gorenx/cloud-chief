import { useRef, useState, type RefObject } from "react";
import { streamChatResponse } from "@/lib/chat-stream";
import { buildChatRequest, type CallMode, type WorkerTarget } from "@/lib/playground-session";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function usePlaygroundChat(scrollRef: RefObject<HTMLDivElement | null>) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const historyRef = useRef<ChatMessage[]>([]);

  async function send(params: {
    callMode: CallMode;
    effectiveModel: string;
    gateway: string;
    providerSlug?: string;
    workerAccessToken: string;
    workerTestEmail?: string;
    workerTestPassword?: string;
    workerTarget?: WorkerTarget;
    useWorkerToml: boolean;
  }) {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    const userMsg: ChatMessage = { role: "user", content: text };
    historyRef.current = [...historyRef.current, userMsg];
    setMessages((m) => [...m, userMsg]);

    const assistantIdx = historyRef.current.length;
    setMessages((m) => [...m, { role: "assistant", content: "思考中…" }]);

    try {
      const { url, body } = buildChatRequest({
        ...params,
        messages: historyRef.current,
      });
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const content = await streamChatResponse(resp, (acc) => {
        setMessages((m) => {
          const copy = [...m];
          copy[assistantIdx] = { role: "assistant", content: acc };
          return copy;
        });
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      });

      historyRef.current = [...historyRef.current, { role: "assistant", content }];
      setMessages((m) => {
        const copy = [...m];
        copy[assistantIdx] = { role: "assistant", content };
        return copy;
      });
    } catch (e) {
      const err = (e as Error).message;
      setMessages((m) => {
        const copy = [...m];
        copy[assistantIdx] = {
          role: "assistant",
          content: err.startsWith("请求失败") ? err : `错误: ${err}`,
        };
        return copy;
      });
    } finally {
      setSending(false);
    }
  }

  return { messages, input, setInput, sending, send };
}
