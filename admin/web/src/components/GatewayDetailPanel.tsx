import { Link } from "react-router-dom";
import type { GatewayContext, FieldMetaEntry } from "@/types";
import { Card, CardTitle } from "./ui/Card";
import { ModelDetailCard } from "./ModelDetailCard";
import { RoutingFieldList } from "./RoutingFieldList";
import { RoutingSectionHeader } from "./RoutingSectionHeader";
import { SourceBadge } from "./SourceBadge";
import { Chip } from "./ui/Chip";

export function RoutingWarnings({ ctx }: { ctx: GatewayContext }) {
  const warnings: string[] = [];
  const g = ctx.gateway;
  const r = ctx.routing;

  if (!g) warnings.push("无法从 Cloudflare 读取该网关详情");
  if (g && !g.authentication) warnings.push("网关鉴权未开启 — BYOK 场景建议开启 authentication");
  if (!r.provider) warnings.push("CF 上暂无已启用的自定义提供商");

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
  const fields = ctx._meta?.fields ?? {};
  return (
    <Card className="p-4">
      <CardTitle>网关状态</CardTitle>
      {g ? (
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <code className="mono">{g.id}</code>
            <SourceBadge meta={fields["gateway.id"]} />
            {g.is_default && <Chip>default</Chip>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip variant={g.authentication ? "on" : "off"}>
              鉴权 {g.authentication ? "已开启" : "已关闭"}
            </Chip>
            <SourceBadge meta={fields["gateway.authentication"]} />
            <Chip variant={g.collect_logs ? "on" : "off"}>
              日志 {g.collect_logs ? "on" : "off"}
            </Chip>
            <SourceBadge meta={fields["gateway.collect_logs"]} />
          </div>
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
        另：本页 <code className="mono">POST /api/chat</code> 固定使用 admin/.env{" "}
        <code className="mono">DASHSCOPE_API_KEY</code>，与 BYOK 无关。
      </p>
    </Card>
  );
}

export function ByokKeysCard({
  ctx,
  loading,
  fieldMeta,
}: {
  ctx?: GatewayContext | null;
  loading?: boolean;
  fieldMeta?: FieldMetaEntry;
}) {
  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm font-semibold text-[var(--color-text)]">BYOK 密钥</span>
        {fieldMeta && <SourceBadge meta={fieldMeta} />}
      </div>
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
  const fields = ctx._meta?.fields ?? {};

  return (
    <div className="space-y-4">
      <GatewayStatusCard ctx={ctx} />

      <RoutingWarnings ctx={ctx} />

      <Card>
        <RoutingSectionHeader
          title="路由链"
          badge="CF"
          desc="网关与提供商从 CF API 实时解析"
          className="mb-4"
        />
        <RoutingFieldList
          section="cf"
          fieldPrefix="routing"
          routing={{
            invoke_url: r.invoke_url,
            gateway: ctx.gateway?.id ?? "",
            provider_slug: r.provider_slug,
            path: r.path,
            base_url: r.base_url,
            provider: r.provider,
          }}
          fields={fields}
        />
      </Card>

      <ModelDetailCard
        modelId={r.model}
        modelMeta={ctx.model_meta}
        routing={r}
        fieldMeta={fields}
      />

      <ByokKeysCard ctx={ctx} fieldMeta={fields.keys} />
    </div>
  );
}
