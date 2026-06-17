import type { GatewayContext, ModelMeta, RoutingInfo } from "@/types";
import { ByokKeysCard, AdminTokenHintCard, GatewayStatusCard, RoutingWarnings } from "./GatewayDetailPanel";
import { Card, CardTitle } from "./ui/Card";
import { InvokeUrlCopy } from "./InvokeUrlCopy";
import { ModelDetailCard } from "./ModelDetailCard";
import { Chip } from "./ui/Chip";

export function PlaygroundRoutingSidebar({
  routing,
  modelMeta,
  gateway,
  gatewayContext,
  gatewayContextLoading,
  hasAdminToken,
}: {
  routing: RoutingInfo;
  modelMeta: ModelMeta | null;
  gateway: string;
  gatewayContext: GatewayContext | null;
  gatewayContextLoading?: boolean;
  hasAdminToken: boolean;
}) {
  const upstreamBase = routing.base_url || routing.provider?.base_url || "";

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
          <p className="text-[var(--color-muted)]">
            Admin 将请求转发至下方 invoke_url；鉴权密钥来自 .env{" "}
            <code className="mono">DASHSCOPE_API_KEY</code> 或网关 BYOK 配置。
          </p>
        </div>
      </Card>

      <Card className="p-4">
        <CardTitle>路由链</CardTitle>
        <div className="space-y-3 text-sm">
          <div>
            <div className="mb-1 text-xs text-[var(--color-muted)]">invoke_url</div>
            <InvokeUrlCopy url={routing.invoke_url} />
          </div>
          <div className="grid gap-2">
            <div>
              <span className="text-xs text-[var(--color-muted)]">gateway</span>
              <div className="mono mt-0.5">{gateway || "—"}</div>
            </div>
            <div>
              <span className="text-xs text-[var(--color-muted)]">provider_slug</span>
              <div className="mono mt-0.5">{routing.provider_slug || "—"}</div>
            </div>
            <div>
              <span className="text-xs text-[var(--color-muted)]">API path</span>
              <div className="mono mt-0.5 break-all">{routing.path || "—"}</div>
            </div>
            <div>
              <span className="text-xs text-[var(--color-muted)]">上游 base_url</span>
              <div className="mono mt-0.5 break-all">{upstreamBase || "—"}</div>
            </div>
            {routing.provider && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-[var(--color-muted)]">CF 自定义提供商</span>
                <Chip variant={routing.provider.enable !== false ? "on" : "off"}>
                  {routing.provider.slug}
                </Chip>
              </div>
            )}
          </div>
        </div>
      </Card>

      <ModelDetailCard
        modelId={routing.model}
        modelMeta={modelMeta}
        routing={routing}
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
          />
        </>
      )}
    </div>
  );
}
