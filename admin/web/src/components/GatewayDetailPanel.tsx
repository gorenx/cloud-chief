import { Link } from "react-router-dom";
import { useT } from "@/contexts/LocaleContext";
import type { GatewayContext, FieldMetaEntry } from "@/types";
import { Card, CardTitle } from "./ui/Card";
import { ModelDetailCard } from "./ModelDetailCard";
import { RoutingFieldList } from "./RoutingFieldList";
import { RoutingSectionHeader } from "./RoutingSectionHeader";
import { SourceBadge } from "./SourceBadge";
import { Chip } from "./ui/Chip";

export function RoutingWarnings({ ctx }: { ctx: GatewayContext }) {
  const t = useT();
  const warnings: string[] = [];
  const g = ctx.gateway;
  const r = ctx.routing;

  if (!g) warnings.push(t("gatewayDetail.warnNoGateway"));
  if (g && !g.authentication) warnings.push(t("gatewayDetail.warnAuthOff"));
  if (!r.provider) warnings.push(t("gatewayDetail.warnNoProvider"));

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
  const t = useT();
  const g = ctx.gateway;
  const fields = ctx._meta?.fields ?? {};
  return (
    <Card className="p-4">
      <CardTitle>{t("gatewayDetail.statusTitle")}</CardTitle>
      {g ? (
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <code className="mono">{g.id}</code>
            <SourceBadge meta={fields["gateway.id"]} />
            {g.is_default && <Chip>{t("common.defaultLabel")}</Chip>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip variant={g.authentication ? "on" : "off"}>
              {t("gatewayDetail.authLabel")} {g.authentication ? t("common.authOn") : t("common.authOff")}
            </Chip>
            <SourceBadge meta={fields["gateway.authentication"]} />
            <Chip variant={g.collect_logs ? "on" : "off"}>
              {t("gatewayDetail.logsLabel")} {g.collect_logs ? t("common.onLabel") : t("common.offLabel")}
            </Chip>
            <SourceBadge meta={fields["gateway.collect_logs"]} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-err)]">{t("gatewayDetail.notFound")}</p>
      )}
    </Card>
  );
}

export function AdminTokenHintCard() {
  const t = useT();
  return (
    <Card className="p-4">
      <CardTitle desc={t("gatewayDetail.adminTokenDesc")}>{t("gatewayDetail.adminTokenTitle")}</CardTitle>
      <p className="text-xs text-[var(--color-muted)]">
        {t("common.noTokenPrefix")}{" "}
        <Link to="/settings" className="text-[var(--color-accent)] hover:underline">
          {t("common.settingsLink")}
        </Link>{" "}
        {t("common.noTokenSuffix")}
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
  const t = useT();
  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm font-semibold text-[var(--color-text)]">{t("gatewayDetail.byokTitle")}</span>
        {fieldMeta && <SourceBadge meta={fieldMeta} />}
      </div>
      {loading ? (
        <p className="text-sm text-[var(--color-muted)]">{t("common.loading")}</p>
      ) : !ctx || ctx.keys.length === 0 ? (
        ctx?.gateway?.authentication ? (
          <p className="text-xs text-amber-200">⚠ {t("gatewayDetail.byokWarn")}</p>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">{t("gatewayDetail.byokEmpty")}</p>
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
              {k.default_config && <Chip variant="on">{t("keys.defaultChip")}</Chip>}
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
  const t = useT();

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-[var(--color-muted)]">{t("common.loading")}</p>
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
          title={t("gatewayDetail.routingTitle")}
          badge="CF"
          desc={t("gatewayDetail.routingDesc")}
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
