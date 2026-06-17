import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { PlaygroundRoutingSidebar } from "@/components/PlaygroundRoutingSidebar";
import { PlaygroundToolbar } from "@/components/PlaygroundToolbar";
import { Button } from "@/components/ui/Button";
import { usePlaygroundChat } from "@/hooks/usePlaygroundChat";
import { usePlaygroundSession } from "@/hooks/usePlaygroundSession";
import { emptyChatHint } from "@/lib/playground-session";
import { cn } from "@/lib/utils";

export function PlaygroundPage() {
  const chatRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const session = usePlaygroundSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const { messages, input, setInput, sending, send } = usePlaygroundChat(chatRef);

  const {
    token,
    config,
    flags,
    callMode,
    setCallMode,
    workerConfigSource,
    setWorkerConfigSource,
    workerTarget,
    setWorkerTarget,
    effectiveWorkerUrl,
    gateway,
    setGateway,
    setUiModel,
    effectiveModel,
    effectiveGateway,
    modelMeta,
    routing,
    dataView,
    gatewayContext,
    gatewayContextLoading,
    workerAccessToken,
    setWorkerAccessToken,
    workerTestEmail,
    setWorkerTestEmail,
    workerTestPassword,
    setWorkerTestPassword,
    workerHealthChecking,
    workerHealthResult,
    checkWorkerHealth,
    startLocalDev,
    startingLocalDev,
    catalogSynced,
    refetchConfig,
  } = session;

  useEffect(() => {
    const supabase = searchParams.get("supabase");
    if (!supabase) return;
    if (supabase === "connected") {
      toast.success("步骤 1 完成：请选择项目 → 应用配置 → 填写测试账号");
      void refetchConfig();
    } else if (supabase === "error") {
      const reason = searchParams.get("reason") ?? "未知错误";
      toast.error(`Supabase 授权失败：${reason}`);
    }
    searchParams.delete("supabase");
    searchParams.delete("reason");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams, refetchConfig]);

  function handleSend() {
    void send({
      callMode,
      effectiveModel,
      gateway,
      providerSlug: config?.provider_slug,
      workerAccessToken,
      workerTestEmail,
      workerTestPassword,
      workerTarget,
      useWorkerToml: flags.useWorkerToml,
    });
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <PlaygroundToolbar
        callMode={callMode}
        onCallModeChange={setCallMode}
        workerConfigSource={workerConfigSource}
        onWorkerConfigSourceChange={setWorkerConfigSource}
        workerTarget={workerTarget}
        onWorkerTargetChange={setWorkerTarget}
        workerOnlineAvailable={config?.worker.online_available ?? false}
        flags={flags}
        dataView={dataView}
        config={config}
        effectiveGateway={effectiveGateway}
        onGatewayChange={setGateway}
        effectiveModel={effectiveModel}
        onModelChange={setUiModel}
        sidebarOpen={sidebarOpen}
        onSidebarToggle={() => setSidebarOpen((o) => !o)}
        catalogSynced={catalogSynced}
        onStartLocalDev={() => startLocalDev()}
        startingLocalDev={startingLocalDev}
        hasAdminToken={Boolean(token)}
        workerHealthResult={workerHealthResult}
      />

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]">
          <div ref={chatRef} className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="text-center text-sm text-[var(--color-muted)]">
                {emptyChatHint(flags)}
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
                    handleSend();
                  }
                }}
                rows={1}
                placeholder="发送消息…（Enter 发送，Shift+Enter 换行）"
                className="flex-1 resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              />
              <Button disabled={sending || !input.trim()} onClick={handleSend}>
                发送
              </Button>
            </div>
          </div>
        </div>

        {sidebarOpen && routing && (
          <div className="w-80 min-w-0 shrink-0 overflow-y-auto overflow-x-hidden">
            <PlaygroundRoutingSidebar
              routing={routing}
              workerRouting={config?.worker_routing ?? null}
              modelMeta={modelMeta}
              gateway={effectiveGateway}
              gatewayContext={gatewayContext}
              gatewayContextLoading={gatewayContextLoading}
              hasAdminToken={Boolean(token)}
              configMeta={config?._meta}
              dataView={dataView}
              isWorker={flags.isWorker}
              workerInfo={config?.worker ?? null}
              workerAccessToken={workerAccessToken}
              onWorkerAccessTokenChange={setWorkerAccessToken}
              workerTestEmail={workerTestEmail}
              onWorkerTestEmailChange={setWorkerTestEmail}
              workerTestPassword={workerTestPassword}
              onWorkerTestPasswordChange={setWorkerTestPassword}
              onWorkerHealthCheck={() => void checkWorkerHealth()}
              workerHealthChecking={workerHealthChecking}
              workerHealthResult={workerHealthResult}
              workerTarget={workerTarget}
              effectiveWorkerUrl={effectiveWorkerUrl}
              onConfigRefresh={() => void refetchConfig()}
            />
          </div>
        )}
      </div>
    </div>
  );
}
