import { useRef, useState, useEffect } from "react";
import { PanelRightClose, PanelRightOpen, Route } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { useT } from "@/contexts/LocaleContext";
import { PlaygroundRoutingSidebar } from "@/components/PlaygroundRoutingSidebar";
import {
  PlaygroundChatToolbar,
  PlaygroundGatewayToolbar,
  PlaygroundWorkerToolbar,
} from "@/components/PlaygroundToolbar";
import { PlaygroundChatConsole } from "@/components/PlaygroundChatConsole";
import { PlaygroundWorkerMainPanel } from "@/components/PlaygroundWorkerMainPanel";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { usePlaygroundChat } from "@/hooks/usePlaygroundChat";
import { usePlaygroundSession } from "@/hooks/usePlaygroundSession";
import type { DebugTab } from "@/lib/playground-session";
import {
  buildWorkerUpstreamUrl,
  readWorkerConsoleMode,
  type WorkerConsoleMode,
} from "@/lib/worker-http-routes";

export function PlaygroundPage() {
  const t = useT();
  const chatRef = useRef<HTMLDivElement>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [workerConsoleMode, setWorkerConsoleMode] = useState<WorkerConsoleMode>(readWorkerConsoleMode);
  const [workerApiMethod, setWorkerApiMethod] = useState("POST");
  const [workerApiPath, setWorkerApiPath] = useState("/v1/responses");
  const [workerApiHost, setWorkerApiHost] = useState("");

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
    workerTierModels,
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
    workerCapabilities,
    refetchConfig,
  } = session;

  useEffect(() => {
    setWorkerApiHost(effectiveWorkerUrl.replace(/\/$/, ""));
  }, [effectiveWorkerUrl, workerDir]);

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
    workerTierModels,
    workerHasGatewayModelVars: workerCapabilities
      ? workerCapabilities.uses_gateway || workerCapabilities.uses_model
      : false,
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

  function handleWorkerChatSend() {
    void send({
      path: "worker",
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

  const isApiOnlyWorker = flags.hideGatewayModel;
  const showInspectorPanel = Boolean(routing || isApiOnlyWorker);

  const apiWorkerBase = workerApiHost || effectiveWorkerUrl;

  const workerInspectorEndpoint =
    !flags.supportsChat || workerConsoleMode === "api"
      ? `${workerApiMethod} ${buildWorkerUpstreamUrl(apiWorkerBase, workerApiPath)}`
      : "POST /api/worker-chat";

  const inspectorEndpoint =
    activeTab === "worker"
      ? workerInspectorEndpoint
      : requestPath === "worker"
        ? !flags.supportsChat
          ? `${workerApiMethod} ${buildWorkerUpstreamUrl(apiWorkerBase, workerApiPath)}`
          : "POST /api/worker-chat"
        : "POST /api/chat";

  const inspectorToggle = showInspectorPanel ? (
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
                    workerEndpoints={config?.worker.url_endpoints ?? []}
                    workerTarget={workerTarget}
                    onWorkerTargetChange={setWorkerTarget}
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
                    workerEndpoints={config?.worker.url_endpoints ?? []}
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
              {activeTab === "worker" ? (
                <PlaygroundWorkerMainPanel
                  chatRef={chatRef}
                  messages={messages}
                  input={input}
                  onInputChange={setInput}
                  sending={sending}
                  onSendChat={handleWorkerChatSend}
                  flags={flags}
                  errorPrefixes={errorPrefixes}
                  workerDir={workerDir}
                  workerTarget={workerTarget}
                  workerAccessToken={workerAccessToken}
                  workerTestEmail={workerTestEmail}
                  workerTestPassword={workerTestPassword}
                  effectiveWorkerUrl={effectiveWorkerUrl}
                  onModeChange={setWorkerConsoleMode}
                  onApiRequestChange={(method, path) => {
                    setWorkerApiMethod(method);
                    setWorkerApiPath(path);
                  }}
                  onApiHostChange={setWorkerApiHost}
                />
              ) : requestPath === "worker" && !flags.supportsChat ? (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                  <p className="max-w-md text-sm leading-relaxed text-[var(--color-muted)]">
                    {t("playground.chatHintApiWorker")}
                  </p>
                </div>
              ) : (
                <PlaygroundChatConsole
                  chatRef={chatRef}
                  messages={messages}
                  input={input}
                  onInputChange={setInput}
                  sending={sending}
                  onSend={handleSend}
                  hintPath={requestPath}
                  flags={flags}
                  errorPrefixes={errorPrefixes}
                />
              )}
            </section>
          </div>
        </div>

        {inspectorOpen && showInspectorPanel && (
          <aside
            className="relative flex w-[min(100%,21rem)] shrink-0 flex-col border-l border-[var(--color-border-subtle)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-panel)_96%,var(--color-ice)_4%)_0%,var(--color-panel)_42%,color-mix(in_srgb,var(--color-panel)_98%,black)_100%)] shadow-[-12px_0_32px_rgba(0,0,0,0.28)] before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-[linear-gradient(180deg,transparent_0%,color-mix(in_srgb,var(--color-ice)_35%,transparent)_18%,color-mix(in_srgb,var(--color-accent)_45%,transparent)_50%,color-mix(in_srgb,var(--color-ice)_25%,transparent)_82%,transparent_100%)]"
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
                    {inspectorEndpoint}
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
                requestPath={activeTab === "worker" || requestPath === "worker" ? "worker" : "gateway"}
                depth={activeTab === "chat" ? "compact" : "full"}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
