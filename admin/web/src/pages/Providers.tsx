import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { useLocale } from "@/contexts/LocaleContext";
import { adminFetch, fetchState } from "@/lib/api";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Chip } from "@/components/ui/Chip";
import { PageHeader } from "@/components/ui/PageHeader";
import { GatewaySetupFlow } from "@/components/GatewaySetupFlow";
import { NoTokenPrompt } from "@/components/NoTokenPrompt";
import { SyncStatus } from "@/components/SyncStatus";

export function ProvidersPage() {
  const { token } = useAdminToken();
  const { t, displayError } = useLocale();
  const qc = useQueryClient();
  const [slug, setSlug] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
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

  const saveMut = useMutation({
    mutationFn: async () => {
      const r = await adminFetch(token, "POST", "/admin/providers", {
        slug: slug.trim(),
        base_url: baseUrl.trim(),
        name: slug.trim(),
      });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success(t("providers.toastSaved"));
      setSlug("");
      setBaseUrl("");
      void qc.invalidateQueries({ queryKey: ["state"] });
    },
    onError: (e) => toast.error(displayError(e instanceof Error ? e.message : String(e))),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await adminFetch(token, "DELETE", `/admin/providers?id=${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success(t("providers.toastDeleted"));
      void qc.invalidateQueries({ queryKey: ["state"] });
    },
    onError: (e) => toast.error(displayError(e instanceof Error ? e.message : String(e))),
  });

  const list = stateQ.data?.providers ?? [];

  useEffect(() => {
    const d = stateQ.data?.defaults;
    if (!d) return;
    if (!slug && d.provider_slug) setSlug(d.provider_slug);
    if (!baseUrl && d.base_url) setBaseUrl(d.base_url);
  }, [stateQ.data?.defaults, slug, baseUrl]);

  if (!token) {
    return <NoTokenPrompt />;
  }

  return (
    <div className="space-y-8">
      <PageHeader title={t("providers.title")} description={t("providers.desc")} />

      <GatewaySetupFlow current="provider" collapsible />

      <SyncStatus
        label={t("providers.list")}
        meta={stateQ.data?._sync?.providers}
        onRefresh={() => setRefreshTick((v) => v + 1)}
        refreshing={stateQ.isFetching}
      />

      <Card>
        <CardTitle>{t("providers.list")}</CardTitle>
        {list.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">{t("providers.empty")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]">
                <th className="pb-2">slug</th>
                <th className="pb-2">base_url</th>
                <th className="pb-2">{t("providers.enabled")}</th>
                <th className="pb-2">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-b border-[var(--color-border)]/60">
                  <td className="py-3">
                    <code className="mono">{p.slug}</code>
                  </td>
                  <td className="py-3 text-[var(--color-muted)]">{p.base_url}</td>
                  <td className="py-3">
                    <Chip variant={p.enable ? "on" : "off"}>
                      {p.enable ? t("common.yes") : t("common.no")}
                    </Chip>
                  </td>
                  <td className="py-3">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        if (confirm(t("providers.confirmDelete", { slug: p.slug }))) {
                          delMut.mutate(p.id);
                        }
                      }}
                    >
                      {t("common.delete")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <CardTitle>{t("providers.createTitle")}</CardTitle>
        <p className="mb-3 text-xs text-[var(--color-muted)]">{t("providers.baseUrlHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">slug</label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="qwen-beijing-maas" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">base_url</label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://xxx.maas.aliyuncs.com"
            />
          </div>
        </div>
        <Button
          className="mt-4"
          disabled={!slug.trim() || !baseUrl.trim() || saveMut.isPending}
          onClick={() => saveMut.mutate()}
        >
          {t("common.createUpdate")}
        </Button>
      </Card>
    </div>
  );
}
