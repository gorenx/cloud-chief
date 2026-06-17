import { Link } from "react-router-dom";
import type { GatewayContext } from "@/types";
import { Card, CardTitle } from "./ui/Card";
import { InvokeUrlCopy } from "./InvokeUrlCopy";
import { ModelDetailCard } from "./ModelDetailCard";
import { Chip } from "./ui/Chip";

export function RoutingWarnings({ ctx }: { ctx: GatewayContext }) {
  const warnings: string[] = [];
  const g = ctx.gateway;
  const r = ctx.routing;

  if (!g) warnings.push("无法从 Cloudflare 读取该网关详情");
  if (g && !g.authentication) warnings.push("网关鉴权未开启 — BYOK 场景建议开启 authentication");
  if (r.provider_slug && !r.provider) warnings.push(`提供商 slug「${r.provider_slug}」不在自定义提供商列表中`);

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-1 rounded-lg border border-amber-900/40 bg-amber-950/20 p-3">
      {warnings.map((w) => (
        <p key={w} className="text-xs text-amber-200">⚠ {w}</p>
      ))}
    </div>
  );
}

export function GatewayStatusCard({ ctx }: { ctx: GatewayContext }) {
  const g = ctx.gateway;
  return (
    <Card className="p-4">
      <CardTitle>网关状态</CardTitle>
      {g ? (
        <div className="flex flex-wrap gap-2 text-sm">
          <code className="mono">{g.id}</code>
          {g.is_default && <Chip>default</Chip>}
          <Chip variant={g.authentication ? "on" : "off"}>
            鉴权 {g.authentication ? "已开启" : "已关闭"}
          </Chip>
          <Chip variant={g.collect_logs ? "on" : "off"}>
            日志 {g.collect_logs ? "on" : "off"}
          </Chip>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-err)]">网关不存在或无法读取</p>
      )}
    </Card>
  );
}

export function AdminTokenHintCard() {
  return (
    <Card className="p-4">
      <CardTitle desc="用于调用 /admin 管理接口，与网关 BYOK 上游密钥无关">
        需要 Admin Token
      </CardTitle>
      <p className="text-xs text-[var(--color-muted)]">
        在{" "}
        <Link to="/settings" className="text-[var(--color-accent)] hover:underline">
          设置
        </Link>{" "}
        中配置后，方可从 Cloudflare 拉取下方网关状态与 BYOK 密钥列表。
      </p>
    </Card>
  );
}

export function ByokKeysCard({
  ctx,
  loading,
}: {
  ctx?: GatewayContext | null;
  loading?: boolean;
}) {
  return (
    <Card className="p-4">
      <CardTitle>BYOK 密钥</CardTitle>
      {loading ? (
        <p className="text-sm text-[var(--color-muted)]">加载中…</p>
      ) : !ctx || ctx.keys.length === 0 ? (
        ctx?.gateway?.authentication ? (
          <p className="text-xs text-amber-200">⚠ 该网关暂无 BYOK 密钥</p>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">暂无密钥</p>
        )
      ) : (
        <ul className="space-y-2">
          {ctx.keys.map((k) => (
            <li
              key={k.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              <code className="mono">{k.provider_slug}</code>
              <span className="text-[var(--color-muted)]">{k.alias}</span>
              {k.default_config && <Chip variant="on">默认</Chip>}
              {k.secret_preview && (
                <span className="text-xs text-[var(--color-muted)]">{k.secret_preview}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function GatewayDetailPanel({ ctx, loading }: { ctx: GatewayContext | null; loading?: boolean }) {
  if (loading) {
    return (
      <Card>
        <p className="text-sm text-[var(--color-muted)]">加载中…</p>
      </Card>
    );
  }

  if (!ctx) return null;

  const r = ctx.routing;

  return (
    <div className="space-y-4">
      <GatewayStatusCard ctx={ctx} />

      <RoutingWarnings ctx={ctx} />

      <Card>
        <CardTitle>路由链</CardTitle>
        <div className="space-y-3 text-sm">
          <div>
            <div className="mb-1 text-xs text-[var(--color-muted)]">invoke_url</div>
            <InvokeUrlCopy url={r.invoke_url} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <span className="text-xs text-[var(--color-muted)]">provider_slug</span>
              <div className="mono mt-0.5">{r.provider_slug || "—"}</div>
            </div>
            <div>
              <span className="text-xs text-[var(--color-muted)]">API path</span>
              <div className="mono mt-0.5 break-all">{r.path}</div>
            </div>
            <div className="sm:col-span-2">
              <span className="text-xs text-[var(--color-muted)]">上游 base_url</span>
              <div className="mono mt-0.5 break-all">{r.base_url || r.provider?.base_url || "—"}</div>
            </div>
          </div>
        </div>
      </Card>

      <ModelDetailCard modelId={r.model} modelMeta={ctx.model_meta} routing={r} />

      <ByokKeysCard ctx={ctx} />
    </div>
  );
}
