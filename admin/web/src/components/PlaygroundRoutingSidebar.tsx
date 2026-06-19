import { useT } from "@/contexts/LocaleContext";
import type { GatewayContext, ModelMeta, ResponseMeta, RoutingInfo, WorkerDebugInfo, WorkerRoutingInfo } from "@/types";
import { pickFields } from "@/lib/field-meta";
import type { PlaygroundDataView } from "@/lib/playground-sources";
import type { WorkerTarget } from "@/lib/playground-session";
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
  isWorker,
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
}: {
  routing: RoutingInfo;
  workerRouting: WorkerRoutingInfo | null;
  modelMeta: ModelMeta | null;
  gateway: string;
  gatewayContext: GatewayContext | null;
  gatewayContextLoading?: boolean;
  hasAdminToken: boolean;
  configMeta?: ResponseMeta;
  dataView: PlaygroundDataView;
  isWorker: boolean;
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
}) {
  const t = useT();
  const routingFields = pickFields(configMeta);
  const { controls } = dataView;
  const showWorkerRouting = dataView.routingSection === "worker";
  const showCfRouting = dataView.routingSection === "cf";
  const hasByok = (gatewayContext?.keys.length ?? 0) > 0;

  return (
    <div className="space-y-4 page-enter page-enter-delay-1">
      {isWorker && workerInfo && (
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
        <CardTitle desc={isWorker ? t("routing.requestDescWorker") : t("routing.requestDescGateway")}>
          {t("routing.requestTitle")}
        </CardTitle>
        <div className="min-w-0 space-y-2 text-xs">
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-2 ring-1 ring-[var(--color-border-subtle)]">
            <code className="mono text-[var(--color-ice)]/90">
              {isWorker ? "POST /api/worker-chat" : "POST /api/chat"}
            </code>
          </div>
          {!isWorker && (
            <p className="text-[var(--color-muted)]">
              {t("routing.requestBody", { gateway: gateway || "—" })}
            </p>
          )}
          {isWorker && workerInfo ? (
            <>
              {workerInfo.cf_error && (
                <p className="text-xs text-[var(--color-warn)]">
                  {t("routing.cfWorkerParse", { error: workerInfo.cf_error })}
                </p>
              )}
              {workerInfo.vars_source && workerInfo.vars_source !== "wrangler" && (
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
            <ChatAuthPathNotice chatAuthMeta={controls.request} hasByok={hasByok} />
          )}
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 space-y-2">
          <RoutingSectionHeader
            title={t("routing.chainTitle")}
            badge={showWorkerRouting ? "Worker" : "CF"}
            desc={
              showWorkerRouting
                ? "wrangler.toml [vars]"
                : isWorker
                  ? t("routing.chainDescUi")
                  : t("routing.chainDescCf")
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
              }}
              fields={routingFields}
            />
          )}
        </div>
      </Card>

      <ModelDetailCard
        modelId={routing.model}
        modelMeta={modelMeta}
        routing={routing}
        fieldMeta={routingFields}
        compact
        showWorker={showWorkerRouting}
        workerModel={workerRouting?.default_model}
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
    </div>
  );
}
