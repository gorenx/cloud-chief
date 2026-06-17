import { useQuery } from "@tanstack/react-query";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { fetchState, fetchGatewayContext, fetchWorkerStatus } from "@/lib/api";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ModelDetailCard } from "@/components/ModelDetailCard";
import { Link } from "react-router-dom";

export function DashboardPage() {
  const { token } = useAdminToken();

  const stateQ = useQuery({
    queryKey: ["state", token],
    queryFn: async () => {
      const r = await fetchState(token);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token),
  });

  const defaultGw = stateQ.data?.defaults.gateway;
  const ctxQ = useQuery({
    queryKey: ["gateway-context", token, defaultGw],
    queryFn: async () => {
      const r = await fetchGatewayContext(token, defaultGw!);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token && defaultGw),
  });

  const workerQ = useQuery({
    queryKey: ["worker-status", token],
    queryFn: async () => {
      const r = await fetchWorkerStatus(token);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token),
  });

  if (!token) {
    return (
      <div>
        <h1 className="text-xl font-semibold">概览</h1>
        <p className="mt-4 text-sm text-[var(--color-muted)]">
          请先在 <Link to="/settings" className="text-[var(--color-accent)]">设置</Link> 中配置 admin 令牌。
        </p>
      </div>
    );
  }

  const s = stateQ.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">概览</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">环境就绪状态与默认路由</p>
      </div>

      {stateQ.isError && (
        <p className="text-sm text-[var(--color-err)]">{String(stateQ.error)}</p>
      )}

      {s && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <div className="text-xs text-[var(--color-muted)]">Cloudflare API</div>
            <div className="mt-2">
              <Chip variant={s.has_api_token ? "on" : "off"}>
                {s.has_api_token ? "Token 已配置" : "未配置 CF_API_TOKEN"}
              </Chip>
            </div>
          </Card>
          <Card>
            <div className="text-xs text-[var(--color-muted)]">网关</div>
            <div className="mt-2 text-2xl font-semibold">{s.gateways.length}</div>
          </Card>
          <Card>
            <div className="text-xs text-[var(--color-muted)]">自定义提供商</div>
            <div className="mt-2 text-2xl font-semibold">{s.providers.length}</div>
          </Card>
          <Card>
            <div className="text-xs text-[var(--color-muted)]">Wrangler</div>
            <div className="mt-2">
              {workerQ.data ? (
                <Chip variant={workerQ.data.logged_in ? "on" : "off"}>
                  {workerQ.data.logged_in ? "已登录" : "未登录"}
                </Chip>
              ) : (
                <span className="text-sm text-[var(--color-muted)]">—</span>
              )}
            </div>
          </Card>
        </div>
      )}

      {ctxQ.data && (
        <div>
          <CardTitle>默认网关 · 大模型路由</CardTitle>
          <div className="mt-3 max-w-xl">
            <ModelDetailCard
              modelId={ctxQ.data.routing.model}
              modelMeta={ctxQ.data.model_meta}
              routing={ctxQ.data.routing}
              compact
            />
          </div>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            账号 <code className="mono">{s?.account_id}</code> · 默认网关{" "}
            <code className="mono">{s?.defaults.gateway}</code>
          </p>
        </div>
      )}
    </div>
  );
}
