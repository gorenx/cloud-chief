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
  const routingFields = pickFields(configMeta);
  const { controls } = dataView;
  const showWorkerRouting = dataView.routingSection === "worker";
  const showCfRouting = dataView.routingSection === "cf";
  const hasByok = (gatewayContext?.keys.length ?? 0) > 0;

  return (
    <div className="space-y-4">
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
        <CardTitle desc={isWorker ? "经 Worker 边缘代理验签后转发" : "由 Admin 代理转发至 AI Gateway"}>
          本页请求
        </CardTitle>
        <div className="min-w-0 space-y-2 text-xs">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
            <code className="mono text-[var(--color-text)]">
              {isWorker ? "POST /api/worker-chat" : "POST /api/chat"}
            </code>
          </div>
          {!isWorker && (
            <p className="text-[var(--color-muted)]">
              请求体含 <code className="mono">model</code>、<code className="mono">messages</code>
              ，网关 <code className="mono">{gateway || "—"}</code>。
            </p>
          )}
          {isWorker && workerInfo ? (
            <>
              {workerInfo.cf_error && (
                <p className="text-xs text-amber-200">
                  CF Worker 解析：{workerInfo.cf_error}（已回退 wrangler.toml / .env）
                </p>
              )}
              {workerInfo.vars_source && workerInfo.vars_source !== "wrangler" && (
                <p className="text-[10px] text-[var(--color-muted)]">
                  Worker vars 来源：
                  {workerInfo.vars_source === "cf" ? "CF 部署" : "CF + wrangler 合并"}
                  {workerInfo.url_source === "cf" ? ` · URL：${workerInfo.url}` : ""}
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
            title="路由链"
            badge={showWorkerRouting ? "Worker" : "CF"}
            desc={
              showWorkerRouting
                ? "wrangler.toml [vars]"
                : isWorker
                  ? "调试界面 CF 对照（Worker 实际仍走 wrangler）"
                  : "CF API 实时解析"
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
              <p className="text-sm text-[var(--color-muted)]">加载网关状态…</p>
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
