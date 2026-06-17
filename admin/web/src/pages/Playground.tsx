import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { fetchGatewayContext, fetchPublicConfig } from "@/lib/api";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { PlaygroundRoutingSidebar } from "@/components/PlaygroundRoutingSidebar";
import { SourceBadge } from "@/components/SourceBadge";
import type { ModelMeta, PublicConfig } from "@/types";
import { playgroundRouting } from "@/lib/routing";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function PlaygroundPage() {
  const { token } = useAdminToken();
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [gateway, setGateway] = useState("");
  const [model, setModel] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const chatRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<Message[]>([]);

  const configQ = useQuery({
    queryKey: ["public-config"],
    queryFn: async () => {
      const r = await fetchPublicConfig();
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
  });

  const gatewayCtxQ = useQuery({
    queryKey: ["gateway-context", token, gateway],
    queryFn: async () => {
      const r = await fetchGatewayContext(token, gateway);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token && gateway),
  });

  useEffect(() => {
    if (configQ.data) {
      setConfig(configQ.data);
      setGateway(configQ.data.gateway);
      setModel(configQ.data.model);
    }
  }, [configQ.data]);

  const modelMeta: ModelMeta | null =
    config?.models.find((m) => m.id === model) ?? null;

  const routing = config ? playgroundRouting(config, gateway, model) : null;
  const fieldMeta = config?._meta?.fields;

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    const userMsg: Message = { role: "user", content: text };
    historyRef.current = [...historyRef.current, userMsg];
    setMessages((m) => [...m, userMsg]);

    const assistantIdx = historyRef.current.length;
    setMessages((m) => [...m, { role: "assistant", content: "思考中…" }]);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: historyRef.current,
          gateway: gateway || undefined,
          provider_slug: config?.provider_slug || undefined,
        }),
      });

      const ctype = resp.headers.get("content-type") ?? "";
      if (!resp.ok || !ctype.includes("text/event-stream")) {
        const j = await resp.json().catch(() => null);
        const err = `请求失败 (${resp.status}): ${JSON.stringify(j)}`;
        setMessages((m) => {
          const copy = [...m];
          copy[assistantIdx] = { role: "assistant", content: err };
          return copy;
        });
        return;
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
            const ev = JSON.parse(data) as { type?: string; delta?: string; error?: unknown };
            if (ev.type === "response.output_text.delta" && ev.delta) {
              acc += ev.delta;
              setMessages((m) => {
                const copy = [...m];
                copy[assistantIdx] = { role: "assistant", content: acc };
                return copy;
              });
            }
          } catch {
            /* ignore parse errors */
          }
        }
        chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
      }

      const content = acc || "(无内容返回)";
      historyRef.current = [...historyRef.current, { role: "assistant", content }];
      setMessages((m) => {
        const copy = [...m];
        copy[assistantIdx] = { role: "assistant", content };
        return copy;
      });
    } catch (e) {
      setMessages((m) => {
        const copy = [...m];
        copy[assistantIdx] = { role: "assistant", content: `错误: ${(e as Error).message}` };
        return copy;
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">聊天调试</h1>
          <div className="flex items-center gap-1.5">
            <Select
              value={gateway}
              onChange={(e) => setGateway(e.target.value)}
              className="w-auto min-w-[140px]"
            >
              {(config?.gateways ?? []).map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
            {fieldMeta?.gateways && <SourceBadge meta={fieldMeta.gateways} />}
          </div>
          <div className="flex items-center gap-1.5">
            <Select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-auto min-w-[160px]"
            >
              {(config?.models ?? [{ id: model, display_name: model, family: "other" as const, supports_thinking: false }]).map(
                (m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name || m.id}
                  </option>
                ),
              )}
            </Select>
            {fieldMeta?.models && <SourceBadge meta={fieldMeta.models} />}
          </div>
        <Button variant="ghost" size="sm" onClick={() => setSidebarOpen((o) => !o)}>
          {sidebarOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          路由详情
        </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]">
          <div ref={chatRef} className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="text-center text-sm text-[var(--color-muted)]">
                通过 Cloudflare AI Gateway 对话，输入消息开始。
              </p>
            ) : (
              <div className="mx-auto max-w-2xl space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-3",
                      msg.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                        msg.role === "user"
                          ? "bg-[var(--color-accent)]/20 text-[var(--color-text)]"
                          : "bg-[var(--color-bg)] text-[var(--color-text)]",
                        msg.content.startsWith("请求失败") || msg.content.startsWith("错误")
                          ? "text-red-300"
                          : "",
                      )}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-[var(--color-border)] p-4">
            <div className="mx-auto flex max-w-2xl gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                placeholder="发送消息…（Enter 发送，Shift+Enter 换行）"
                className="flex-1 resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              />
              <Button disabled={sending || !input.trim()} onClick={() => void send()}>
                发送
              </Button>
            </div>
          </div>
        </div>

        {sidebarOpen && routing && (
          <div className="w-80 shrink-0 overflow-y-auto">
            <PlaygroundRoutingSidebar
              routing={routing}
              modelMeta={modelMeta}
              gateway={gateway}
              gatewayContext={gatewayCtxQ.data ?? null}
              gatewayContextLoading={gatewayCtxQ.isLoading}
              hasAdminToken={Boolean(token)}
              configMeta={config?._meta}
            />
          </div>
        )}
      </div>
    </div>
  );
}
