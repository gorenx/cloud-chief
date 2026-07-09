import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { useLocale } from "@/contexts/LocaleContext";
import { fetchState, fetchGatewayContext, fetchWorkerStatus } from "@/lib/api";
import { CardTitle, StatCard } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { PageHeader } from "@/components/ui/PageHeader";
import { ModelDetailCard } from "@/components/ModelDetailCard";
import { GatewaySetupFlow } from "@/components/GatewaySetupFlow";
import { NoTokenPrompt } from "@/components/NoTokenPrompt";
import { SyncStatus } from "@/components/SyncStatus";

export function DashboardPage() {
  const { token } = useAdminToken();
  const { t, displayError } = useLocale();
  const [refreshTick, setRefreshTick] = useState(0);

  const stateQ = useQuery({
    queryKey: ["state", token, refreshTick],
    queryFn: async () => {
      const r = await fetchState(token, { refresh: refreshTick > 0 });
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
      <div className="page-enter space-y-4">
        <PageHeader title={t("dashboard.title")} />
        <NoTokenPrompt suffixKey="dashboard.noTokenSuffix" />
      </div>
    );
  }

  const s = stateQ.data;

  return (
    <div className="space-y-8">
      <PageHeader title={t("dashboard.title")} description={t("dashboard.desc")} />

      {stateQ.isError && (
        <p className="text-sm text-[var(--color-err)]">
          {displayError(stateQ.error instanceof Error ? stateQ.error.message : String(stateQ.error))}
        </p>
      )}

      {s?._sync && (
        <div className="grid gap-2 md:grid-cols-2">
          <SyncStatus
            label={t("dashboard.gateways")}
            meta={s._sync.gateways}
            onRefresh={() => setRefreshTick((v) => v + 1)}
            refreshing={stateQ.isFetching}
          />
          <SyncStatus
            label={t("dashboard.providers")}
            meta={s._sync.providers}
            onRefresh={() => setRefreshTick((v) => v + 1)}
            refreshing={stateQ.isFetching}
          />
        </div>
      )}

      {s && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t("dashboard.cfApi")}>
            <div className="mt-2">
              <Chip variant={s.has_api_token ? "on" : "off"}>
                {s.has_api_token ? t("dashboard.tokenConfigured") : t("dashboard.tokenMissing")}
              </Chip>
            </div>
          </StatCard>
          <StatCard label={t("dashboard.gateways")} value={s.gateways.length} />
          <StatCard label={t("dashboard.providers")} value={s.providers.length} />
          <StatCard label={t("dashboard.wrangler")}>
            <div className="mt-2">
              {workerQ.data ? (
                <Chip variant={workerQ.data.logged_in ? "on" : "off"}>
                  {workerQ.data.logged_in
                    ? t("worker.status.loggedIn")
                    : t("worker.status.notLoggedIn")}
                </Chip>
              ) : (
                <span className="text-sm text-[var(--color-muted)]">—</span>
              )}
            </div>
          </StatCard>
        </div>
      )}

      {ctxQ.data && (
        <section className="page-enter page-enter-delay-2 space-y-3">
          <CardTitle>{t("dashboard.defaultRouting")}</CardTitle>
          <div className="max-w-xl">
            <ModelDetailCard
              modelId={ctxQ.data.routing.model}
              modelMeta={ctxQ.data.model_meta}
              routing={ctxQ.data.routing}
              compact
            />
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            {t("dashboard.accountDefault", {
              account: s?.account_id ?? "",
              gateway: s?.defaults.gateway ?? "",
            })}
          </p>
        </section>
      )}

      <div className="page-enter page-enter-delay-3">
        <GatewaySetupFlow />
      </div>
    </div>
  );
}
