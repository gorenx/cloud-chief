import { useRef, useState, useEffect } from "react";
import { PanelRightClose, PanelRightOpen, Route } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { useT } from "@/contexts/LocaleContext";
import { emptyChatHint } from "@/i18n/playground-ui";
import { PlaygroundRoutingSidebar } from "@/components/PlaygroundRoutingSidebar";
import {
  PlaygroundChatToolbar,
  PlaygroundGatewayToolbar,
  PlaygroundWorkerToolbar,
} from "@/components/PlaygroundToolbar";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { usePlaygroundChat } from "@/hooks/usePlaygroundChat";
import { usePlaygroundSession } from "@/hooks/usePlaygroundSession";
import type { DebugTab } from "@/lib/playground-session";
import { cn } from "@/lib/utils";

export function PlaygroundPage() {
  const t = useT();
  const chatRef = useRef<HTMLDivElement>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  const session = usePlaygroundSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const { messages, input, setInput, sending, send, errorPrefixes } = usePlaygroundChat(chatRef);

  const {
    token,
    activeTab,
    setActiveTab,
    chatPath,
    setChatPath,
    requestPath,
    config,
    flags,
    workerConfigSource,
    setWorkerConfigSource,
    workerTarget,
    setWorkerTarget,
    workerDir,
    setWorkerDir,
    workers,
    workersLoading,
    effectiveWorkerUrl,
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
      toast.success(t("playground.toastSupabaseStep1"));
      void refetchConfig();
    } else if (supabase === "error") {
      const reason = searchParams.get("reason") ?? t("common.unknownError");
      toast.error(t("playground.toastSupabaseError", { reason }));
    }
    searchParams.delete("supabase");
    searchParams.delete("reason");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams, refetchConfig, t]);

  const tabOptions: { value: DebugTab; label: string }[] = [
    { value: "chat", label: t("playground.tabChat") },
    { value: "gateway", label: t("playground.tabGateway") },
    { value: "worker", label: t("playground.tabWorker") },
  ];

  const sharedToolbarProps = {
    layout: "sidebar" as const,
    flags,
    dataView,
    config,
    effectiveGateway,
    onGatewayChange: setGateway,
    effectiveModel,
    onModelChange: setUiModel,
    catalogSynced,
  };

  function handleSend() {
    void send({
      path: requestPath,
      effectiveModel,
      gateway: effectiveGateway,
      providerSlug: routing?.provider_slug,
      workerAccessToken,
      workerTestEmail,
      workerTestPassword,
      workerTarget,
      workerDir,
      useWorkerToml: flags.useWorkerToml,
    });
  }

  const inspectorToggle = routing ? (
    <Button
      variant="ghost"
      size="sm"
      className="shrink-0 text-[var(--color-muted)]"
      onClick={() => setInspectorOpen((open) => !open)}
    >
      {inspectorOpen ? (
        <PanelRightClose className="h-4 w-4" aria-hidden />
      ) : (
        <PanelRightOpen className="h-4 w-4" aria-hidden />
      )}
      {inspectorOpen ? t("playground.hideInspector") : t("playground.inspectorLabel")}
    </Button>
  ) : null;

  return (
    <div className="page-enter flex h-[calc(100dvh-2rem)] min-h-[32rem] flex-col">
      <div className="glass-panel flex min-h-0 flex-1 overflow-hidden rounded-[var(--radius-xl)] shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-panel-elevated)]/30 px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-[var(--radius-sm)] bg-[var(--color-accent-glow)] px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/20">
                  {t("playground.debugBadge")}
                </span>
                <h1 className="font-display text-xl font-semibold tracking-tight text-[var(--color-text)]">
                  {t("playground.title")}
                </h1>
              </div>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--color-muted)]">
                {t("playground.desc")}
              </p>
            </div>
            {!inspectorOpen && inspectorToggle}
          </header>

          <div className="flex min-h-0 flex-1">
            <aside className="flex w-[min(100%,17.5rem)] shrink-0 flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-panel-elevated)]/10">
              <div className="shrink-0 border-b border-[var(--color-border-subtle)] px-3 py-2">
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-muted)]/75">
                  {t("playground.configLabel")}
                </span>
              </div>

              <div className="shrink-0 border-b border-[var(--color-border-subtle)] px-3 py-2.5">
                <SegmentedControl
                  value={activeTab}
                  onChange={setActiveTab}
                  className="flex w-full"
                  options={tabOptions}
                />
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
                {activeTab === "chat" && (
                  <PlaygroundChatToolbar
                    chatPath={chatPath}
                    onChatPathChange={setChatPath}
                    workerDir={workerDir}
                    onWorkerDirChange={setWorkerDir}
                    workers={workers}
                    workersLoading={workersLoading}
                    hasAdminToken={Boolean(token)}
                    {...sharedToolbarProps}
                  />
                )}
                {activeTab === "gateway" && <PlaygroundGatewayToolbar {...sharedToolbarProps} />}
                {activeTab === "worker" && (
                  <PlaygroundWorkerToolbar
                    workerConfigSource={workerConfigSource}
                    onWorkerConfigSourceChange={setWorkerConfigSource}
                    workerTarget={workerTarget}
                    onWorkerTargetChange={setWorkerTarget}
                    workerOnlineAvailable={config?.worker.online_available ?? false}
                    workerDir={workerDir}
                    onWorkerDirChange={setWorkerDir}
                    workers={workers}
                    workersLoading={workersLoading}
                    hasAdminToken={Boolean(token)}
                    onStartLocalDev={() => startLocalDev()}
                    startingLocalDev={startingLocalDev}
                    workerHealthResult={workerHealthResult}
                    {...sharedToolbarProps}
                  />
                )}
              </div>
            </aside>

            <section className="flex min-w-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-[var(--color-border-subtle)] px-4 py-2 sm:px-5">
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-muted)]/75">
                  {t("playground.consoleLabel")}
                </span>
              </div>

              <div ref={chatRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                {messages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[var(--color-muted)]">
                    {emptyChatHint(t, requestPath, flags)}
                  </p>
                ) : (
                  <div className="mx-auto max-w-2xl space-y-3">
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
                            "max-w-[85%] rounded-[var(--radius-lg)] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                            msg.role === "user"
                              ? "bg-[var(--color-accent-glow)] text-[var(--color-text)] ring-1 ring-[var(--color-accent)]/20"
                              : "bg-[var(--color-bg-elevated)] text-[var(--color-text)] ring-1 ring-[var(--color-border-subtle)]",
                            msg.content.startsWith(errorPrefixes.requestFailedPrefix) ||
                              msg.content.startsWith(errorPrefixes.errorPrefix)
                              ? "text-[var(--color-err)] ring-[var(--color-err)]/30"
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

              <div className="shrink-0 border-t border-[var(--color-border-subtle)] bg-[var(--color-panel-elevated)]/20 px-4 py-3 sm:px-5">
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
                    placeholder={t("playground.sendPlaceholder")}
                    className="flex-1 resize-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-glow)]"
                  />
                  <Button disabled={sending || !input.trim()} onClick={handleSend}>
                    {t("playground.send")}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </div>

        {inspectorOpen && routing && (
          <aside
            className={cn(
              "relative flex w-[min(100%,21rem)] shrink-0 flex-col",
              "border-l border-[var(--color-border-subtle)]",
              "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-panel)_96%,var(--color-ice)_4%)_0%,var(--color-panel)_42%,color-mix(in_srgb,var(--color-panel)_98%,black)_100%)]",
              "shadow-[-12px_0_32px_rgba(0,0,0,0.28)]",
              "before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-[linear-gradient(180deg,transparent_0%,color-mix(in_srgb,var(--color-ice)_35%,transparent)_18%,color-mix(in_srgb,var(--color-accent)_45%,transparent)_50%,color-mix(in_srgb,var(--color-ice)_25%,transparent)_82%,transparent_100%)]",
            )}
          >
            <div className="relative flex shrink-0 items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-panel-elevated)]/55 px-4 py-3 backdrop-blur-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-ice)]/8 ring-1 ring-[var(--color-ice)]/15">
                  <Route className="h-3.5 w-3.5 text-[var(--color-ice)]/80" aria-hidden />
                </span>
                <div className="min-w-0">
                  <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-ice)]/85">
                    {t("playground.inspectorLabel")}
                  </span>
                  <span className="block truncate text-[10px] text-[var(--color-muted)]/70">
                    {requestPath === "worker" ? "POST /api/worker-chat" : "POST /api/chat"}
                  </span>
                </div>
              </div>
              {inspectorToggle}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3">
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
                requestPath={requestPath}
                depth={activeTab === "chat" ? "compact" : "full"}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
