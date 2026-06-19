import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { useLocale } from "@/contexts/LocaleContext";
import { adminFetch, fetchGatewayContext, fetchState } from "@/lib/api";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Chip } from "@/components/ui/Chip";
import { PageHeader } from "@/components/ui/PageHeader";
import { GatewayDetailPanel } from "@/components/GatewayDetailPanel";
import { GatewaySetupFlow } from "@/components/GatewaySetupFlow";
import { NoTokenPrompt } from "@/components/NoTokenPrompt";
import { cn } from "@/lib/utils";

export function GatewaysPage() {
  const { token } = useAdminToken();
  const { t, displayError } = useLocale();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gwId, setGwId] = useState("");
  const [gwAuth, setGwAuth] = useState(true);

  const stateQ = useQuery({
    queryKey: ["state", token],
    queryFn: async () => {
      const r = await fetchState(token);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token),
  });

  const ctxQ = useQuery({
    queryKey: ["gateway-context", token, selectedId],
    queryFn: async () => {
      const r = await fetchGatewayContext(token, selectedId!);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token && selectedId),
  });

  const saveMut = useMutation({
    mutationFn: async (body: { id: string; authentication: boolean }) => {
      const r = await adminFetch(token, "POST", "/admin/gateways", body);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: () => {
      toast.success(t("gateways.toastSaved"));
      setGwId("");
      void qc.invalidateQueries({ queryKey: ["state"] });
      void qc.invalidateQueries({ queryKey: ["gateway-context"] });
    },
    onError: (e) => toast.error(displayError(e instanceof Error ? e.message : String(e))),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, authentication }: { id: string; authentication: boolean }) => {
      const r = await adminFetch(token, "POST", "/admin/gateways", { id, authentication });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success(t("gateways.toastUpdated"));
      void qc.invalidateQueries({ queryKey: ["state"] });
      void qc.invalidateQueries({ queryKey: ["gateway-context"] });
    },
    onError: (e) => toast.error(displayError(e instanceof Error ? e.message : String(e))),
  });

  if (!token) {
    return <NoTokenPrompt />;
  }

  const gateways = stateQ.data?.gateways ?? [];
  const defaultGw = stateQ.data?.defaults.gateway;

  useEffect(() => {
    if (!gwId && defaultGw) setGwId(defaultGw);
  }, [defaultGw, gwId]);

  return (
    <div className="space-y-8">
      <PageHeader title={t("gateways.title")} description={t("gateways.desc")} />

      <GatewaySetupFlow current="gateway" collapsible />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Card>
            <CardTitle>{t("gateways.list")}</CardTitle>
            {gateways.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">{t("gateways.empty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]">
                      <th className="pb-2 pr-3">ID</th>
                      <th className="pb-2 pr-3">{t("gateways.auth")}</th>
                      <th className="pb-2 pr-3">{t("gateways.logs")}</th>
                      <th className="pb-2">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gateways.map((g) => (
                      <tr
                        key={g.id}
                        className={cn(
                          "border-b border-[var(--color-border)]/60 transition-colors",
                          selectedId === g.id && "bg-[var(--color-accent)]/10",
                        )}
                      >
                        <td className="py-3 pr-3">
                          <code className="mono">{g.id}</code>
                          {g.is_default && <Chip>{t("common.defaultLabel")}</Chip>}
                        </td>
                        <td className="py-3 pr-3">
                          <Chip variant={g.authentication ? "on" : "off"}>
                            {g.authentication ? t("common.authOn") : t("common.authOff")}
                          </Chip>
                        </td>
                        <td className="py-3 pr-3 text-[var(--color-muted)]">
                          {g.collect_logs ? t("common.onLabel") : t("common.offLabel")}
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedId(g.id)}
                            >
                              {t("gateways.detail")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={toggleMut.isPending}
                              onClick={() =>
                                toggleMut.mutate({
                                  id: g.id,
                                  authentication: !g.authentication,
                                })
                              }
                            >
                              {g.authentication ? t("gateways.toggleAuthOff") : t("gateways.toggleAuthOn")}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardTitle>{t("gateways.createTitle")}</CardTitle>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[160px] flex-1">
                <label className="mb-1 block text-xs text-[var(--color-muted)]">
                  {t("gateways.gatewayId")}
                </label>
                <Input value={gwId} onChange={(e) => setGwId(e.target.value)} placeholder="qwen-gw" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={gwAuth}
                  onChange={(e) => setGwAuth(e.target.checked)}
                  className="accent-[var(--color-accent)]"
                />
                {t("gateways.enableAuth")}
              </label>
              <Button
                disabled={!gwId.trim() || saveMut.isPending}
                onClick={() => saveMut.mutate({ id: gwId.trim(), authentication: gwAuth })}
              >
                {t("common.createUpdate")}
              </Button>
            </div>
          </Card>
        </div>

        {selectedId && (
          <div className="lg:col-span-2">
            <GatewayDetailPanel ctx={ctxQ.data ?? null} loading={ctxQ.isLoading} />
          </div>
        )}
      </div>
    </div>
  );
}
