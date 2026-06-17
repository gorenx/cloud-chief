import type { GatewayContext, ModelMeta, ResponseMeta, RoutingInfo } from "@/types";
import { pickFields } from "@/lib/field-meta";
import { ByokKeysCard, AdminTokenHintCard, GatewayStatusCard, RoutingWarnings } from "./GatewayDetailPanel";
import { RoutingFieldList } from "./RoutingFieldList";
import { ChatAuthPathNotice } from "./PlaygroundSourceNotices";
import { Card, CardTitle } from "./ui/Card";
import { ModelDetailCard } from "./ModelDetailCard";

export function PlaygroundRoutingSidebar({
  routing,
  modelMeta,
  gateway,
  gatewayContext,
  gatewayContextLoading,
  hasAdminToken,
  configMeta,
}: {
  routing: RoutingInfo;
  modelMeta: ModelMeta | null;
  gateway: string;
  gatewayContext: GatewayContext | null;
  gatewayContextLoading?: boolean;
  hasAdminToken: boolean;
  configMeta?: ResponseMeta;
}) {
  const routingFields = pickFields(configMeta);
  const chatAuthMeta = routingFields["chat.authorization"];
  const hasByok = (gatewayContext?.keys.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <CardTitle desc="本页不直接请求 invoke_url，由 Admin 服务代理转发">
          本页请求
        </CardTitle>
        <div className="space-y-2 text-xs">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
            <code className="mono text-[var(--color-text)]">POST /api/chat</code>
          </div>
          <p className="text-[var(--color-muted)]">
            请求体含 <code className="mono">model</code>、<code className="mono">messages</code>
            ，以及当前选择的网关 <code className="mono">{gateway || "—"}</code>。
          </p>
          <ChatAuthPathNotice chatAuthMeta={chatAuthMeta} hasByok={hasByok} />
        </div>
      </Card>

      <Card className="p-4">
        <CardTitle desc="悬停标签查看数据来源">路由链</CardTitle>
        <RoutingFieldList routing={routing} gateway={gateway} fields={routingFields} />
      </Card>

      <ModelDetailCard
        modelId={routing.model}
        modelMeta={modelMeta}
        routing={routing}
        fieldMeta={routingFields}
        compact
      />

      {!hasAdminToken ? (
        <AdminTokenHintCard />
      ) : (
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
      )}
    </div>
  );
}
