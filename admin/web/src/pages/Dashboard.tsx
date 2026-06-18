import { useQuery } from "@tanstack/react-query";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { useLocale } from "@/contexts/LocaleContext";
import { fetchState, fetchGatewayContext, fetchWorkerStatus } from "@/lib/api";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ModelDetailCard } from "@/components/ModelDetailCard";
import { GatewaySetupFlow } from "@/components/GatewaySetupFlow";
import { NoTokenPrompt } from "@/components/NoTokenPrompt";

export function DashboardPage() {
  const { token } = useAdminToken();
  const { t, displayError } = useLocale();

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
        <h1 className="text-xl font-semibold">{t("dashboard.title")}</h1>
        <p className="mt-4">
          <NoTokenPrompt suffixKey="dashboard.noTokenSuffix" />
        </p>
      </div>
    );
  }

  const s = stateQ.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t("dashboard.title")}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{t("dashboard.desc")}</p>
      </div>

      {stateQ.isError && (
        <p className="text-sm text-[var(--color-err)]">
          {displayError(stateQ.error instanceof Error ? stateQ.error.message : String(stateQ.error))}
        </p>
      )}

      {s && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <div className="text-xs text-[var(--color-muted)]">{t("dashboard.cfApi")}</div>
            <div className="mt-2">
              <Chip variant={s.has_api_token ? "on" : "off"}>
                {s.has_api_token ? t("dashboard.tokenConfigured") : t("dashboard.tokenMissing")}
              </Chip>
            </div>
          </Card>
          <Card>
            <div className="text-xs text-[var(--color-muted)]">{t("dashboard.gateways")}</div>
            <div className="mt-2 text-2xl font-semibold">{s.gateways.length}</div>
          </Card>
          <Card>
            <div className="text-xs text-[var(--color-muted)]">{t("dashboard.providers")}</div>
            <div className="mt-2 text-2xl font-semibold">{s.providers.length}</div>
          </Card>
          <Card>
            <div className="text-xs text-[var(--color-muted)]">{t("dashboard.wrangler")}</div>
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
          </Card>
        </div>
      )}

      {ctxQ.data && (
        <div>
          <CardTitle>{t("dashboard.defaultRouting")}</CardTitle>
          <div className="mt-3 max-w-xl">
            <ModelDetailCard
              modelId={ctxQ.data.routing.model}
              modelMeta={ctxQ.data.model_meta}
              routing={ctxQ.data.routing}
              compact
            />
          </div>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            {t("dashboard.accountDefault", {
              account: s?.account_id ?? "",
              gateway: s?.defaults.gateway ?? "",
            })}
          </p>
        </div>
      )}

      <GatewaySetupFlow />
    </div>
  );
}
