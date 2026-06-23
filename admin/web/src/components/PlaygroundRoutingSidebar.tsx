import { useT } from "@/contexts/LocaleContext";
import type { GatewayContext, ModelMeta, ResponseMeta, RoutingInfo, WorkerDebugInfo, WorkerRoutingInfo } from "@/types";
import { pickFields } from "@/lib/field-meta";
import type { PlaygroundDataView } from "@/lib/playground-sources";
import type { ChatPath, WorkerTarget } from "@/lib/playground-session";
import { resolveWorkerTierModels } from "@/lib/playground-session";
import { ByokKeysCard, AdminTokenHintCard, GatewayStatusCard, RoutingWarnings } from "./GatewayDetailPanel";
import { RoutingFieldList } from "./RoutingFieldList";
import { RoutingMismatchNotice, RoutingSectionHeader, RoutingSourceLegend } from "./RoutingSectionHeader";
import { ChatAuthPathNotice } from "./PlaygroundSourceNotices";
import { PlaygroundSourceSummary } from "./PlaygroundSourceSummary";
import { WorkerChatNotice } from "./WorkerChatNotice";
import { SupabaseConnectPanel } from "./SupabaseConnectPanel";
import { Card, CardTitle } from "./ui/Card";
import { ModelDetailCard } from "./ModelDetailCard";

export function PlaygroundRoutingSidebar({
  routing,
  workerRouting,
  modelMeta,
  gateway,
  gatewayContext,
  gatewayContextLoading,
  hasAdminToken,
  configMeta,
  dataView,
  workerInfo,
  workerAccessToken,
  onWorkerAccessTokenChange,
  workerTestEmail,
  onWorkerTestEmailChange,
  workerTestPassword,
  onWorkerTestPasswordChange,
  onWorkerHealthCheck,
  workerHealthChecking,
  workerHealthResult,
  workerTarget,
  effectiveWorkerUrl,
  onConfigRefresh,
  requestPath,
  depth = "full",
}: {
  routing: RoutingInfo | null;
  workerRouting: WorkerRoutingInfo | null;
  modelMeta: ModelMeta | null;
  gateway: string;
  gatewayContext: GatewayContext | null;
  gatewayContextLoading?: boolean;
  hasAdminToken: boolean;
  configMeta?: ResponseMeta;
  dataView: PlaygroundDataView;
  workerInfo: WorkerDebugInfo | null;
  workerAccessToken: string;
  onWorkerAccessTokenChange: (v: string) => void;
  workerTestEmail: string;
  onWorkerTestEmailChange: (v: string) => void;
  workerTestPassword: string;
  onWorkerTestPasswordChange: (v: string) => void;
  onWorkerHealthCheck: () => void;
  workerHealthChecking: boolean;
  workerHealthResult: string | null;
  workerTarget: WorkerTarget;
  effectiveWorkerUrl: string;
  onConfigRefresh?: () => void;
  requestPath: ChatPath;
  depth?: "compact" | "full";
}) {
  const t = useT();
  const routingFields = pickFields(configMeta);
  const { controls } = dataView;
  const isWorkerRequest = requestPath === "worker";
  const isApiOnlyWorker = dataView.routingSection === "api";
  const showWorkerRouting = isWorkerRequest && dataView.routingSection === "worker";
  const showCfRouting = routing && (!isWorkerRequest || dataView.routingSection === "cf");
  const hasByok = (gatewayContext?.keys.length ?? 0) > 0;
  const compact = depth === "compact";
  const tierModels =
    isWorkerRequest && !isApiOnlyWorker
      ? resolveWorkerTierModels({ worker_routing: workerRouting ?? undefined })
      : null;

  return (
    <div className="space-y-4 page-enter page-enter-delay-1">
      {isWorkerRequest && workerInfo && (
        <WorkerChatNotice
          workerUrl={effectiveWorkerUrl}
          workerTarget={workerTarget}
          workerUrlMeta={controls.workerUrl}
          onHealthCheck={onWorkerHealthCheck}
          healthChecking={workerHealthChecking}
          healthResult={workerHealthResult}
          hasAdminToken={hasAdminToken}
        />
      )}

      <Card className="p-4">
        <PlaygroundSourceSummary view={dataView} />
      </Card>

      <Card className="p-4">
        <CardTitle
          desc={
            isWorkerRequest
              ? t("routing.requestDescWorker")
              : t("routing.requestDescGateway")
          }
        >
          {t("routing.requestTitle")}
        </CardTitle>
        <div className="min-w-0 space-y-2 text-xs">
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-2 ring-1 ring-[var(--color-border-subtle)]">
            <code className="mono text-[var(--color-ice)]/90">
              POST {isWorkerRequest ? "/api/worker-chat" : "/api/chat"}
            </code>
          </div>
          {isWorkerRequest && workerInfo ? (
            <>
              {!compact && workerInfo.cf_error && (
                <p className="text-xs text-[var(--color-warn)]">
                  {t("routing.cfWorkerParse", { error: workerInfo.cf_error })}
                </p>
              )}
              {!compact && workerInfo.vars_source && workerInfo.vars_source !== "wrangler" && (
                <p className="text-[10px] text-[var(--color-muted)]">
                  {t("routing.varsSource")}
                  {workerInfo.vars_source === "cf"
                    ? t("routing.varsSourceCf")
                    : t("routing.varsSourceMerged")}
                  {workerInfo.url_source === "cf" ? ` · URL: ${workerInfo.url}` : ""}
                </p>
              )}
              <SupabaseConnectPanel
                supabaseUrl={workerInfo.supabase_url}
                supabaseUrlMeta={controls.supabaseUrl}
                hasAnonKey={workerInfo.has_anon_key}
                hasTestCredentials={workerInfo.has_test_credentials}
                testEmail={workerTestEmail}
                onTestEmailChange={onWorkerTestEmailChange}
                testPassword={workerTestPassword}
                onTestPasswordChange={onWorkerTestPasswordChange}
                accessToken={workerAccessToken}
                onAccessTokenChange={onWorkerAccessTokenChange}
                onApplied={onConfigRefresh}
              />
            </>
          ) : (
            !isWorkerRequest && (
              <ChatAuthPathNotice chatAuthMeta={controls.request} hasByok={hasByok} />
            )
          )}
        </div>
      </Card>

      {!compact && isApiOnlyWorker && workerInfo && (
        <Card className="p-4">
          <CardTitle desc={t("playground.apiWorkerDesc")}>{t("playground.apiWorkerTitle")}</CardTitle>
          <div className="space-y-2 text-xs text-[var(--color-muted)]">
            <p>{t("playground.apiWorkerCapabilities")}</p>
            <ul className="space-y-1">
              <li>
                {t("playground.capGateway")}:{" "}
                <code className="mono">{workerInfo.capabilities.uses_gateway ? "✓" : "—"}</code>
              </li>
              <li>
                {t("playground.capModel")}:{" "}
                <code className="mono">{workerInfo.capabilities.uses_model ? "✓" : "—"}</code>
              </li>
              <li>
                {t("playground.capChat")}:{" "}
                <code className="mono">{workerInfo.capabilities.supports_chat ? "✓" : "—"}</code>
              </li>
            </ul>
            {workerInfo.endpoints.length > 0 && (
              <div>
                <span className="font-medium text-[var(--color-text)]">{t("playground.suggestedEndpoints")}</span>
                <ul className="mt-1.5 space-y-1">
                  {workerInfo.endpoints.map((ep) => (
                    <li key={ep}>
                      <code className="mono text-[var(--color-ice)]/90">{ep}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {!compact && routing && !isApiOnlyWorker && (
        <>
          <Card className="p-4">
            <div className="mb-3 space-y-2">
              <RoutingSectionHeader
                title={t("routing.chainTitle")}
                badge={showWorkerRouting ? "Worker" : "CF"}
                desc={
                  showWorkerRouting
                    ? "wrangler.toml [vars]"
                    : t("routing.chainDescUi")
                }
              />
              <RoutingSourceLegend showWorker={showWorkerRouting} />
            </div>
            <div className="space-y-3">
              {dataView.showRoutingMismatch && (
                <RoutingMismatchNotice
                  cfGateway={gateway}
                  workerGateway={workerRouting?.gateway ?? ""}
                  cfSlug={routing.provider_slug}
                  workerSlug={workerRouting?.provider_slug ?? ""}
                />
              )}
              {showCfRouting && (
                <RoutingFieldList
                  section="cf"
                  fieldPrefix="routing"
                  routing={{
                    invoke_url: routing.invoke_url,
                    gateway,
                    provider_slug: routing.provider_slug,
                    path: routing.path,
                    base_url: routing.base_url,
                    provider: routing.provider,
                  }}
                  fields={routingFields}
                />
              )}
              {showWorkerRouting && workerRouting && (
                <RoutingFieldList
                  section="worker"
                  fieldPrefix="worker_routing"
                  routing={{
                    invoke_url: workerRouting.invoke_url,
                    gateway: workerRouting.gateway,
                    provider_slug: workerRouting.provider_slug,
                    path: workerRouting.path,
                    base_url: workerRouting.base_url,
                    provider: workerRouting.provider,
                    account_id: workerRouting.account_id,
                    default_model: workerRouting.default_model,
                    free_model: workerRouting.free_model,
                    plus_model: workerRouting.plus_model,
                  }}
                  fields={routingFields}
                />
              )}
            </div>
          </Card>

          <ModelDetailCard
            modelId={routing.model}
            modelMeta={tierModels ? null : modelMeta}
            routing={routing}
            fieldMeta={routingFields}
            compact
            showWorker={showWorkerRouting && !tierModels}
            workerModel={workerRouting?.default_model}
            tierModels={tierModels}
          />

          {!hasAdminToken ? (
            <AdminTokenHintCard />
          ) : dataView.showGatewayContext ? (
            <>
              {gatewayContextLoading && (
                <Card className="p-4">
                  <p className="text-sm text-[var(--color-muted)]">{t("gatewayDetail.loadingGw")}</p>
                </Card>
              )}
              {gatewayContext && (
                <>
                  <GatewayStatusCard ctx={gatewayContext} />
                  <RoutingWarnings ctx={gatewayContext} />
                </>
              )}
              <ByokKeysCard
                ctx={gatewayContext}
                loading={gatewayContextLoading}
                fieldMeta={gatewayContext?._meta.fields.keys}
              />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
