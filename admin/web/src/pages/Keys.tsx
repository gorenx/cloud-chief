import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { useLocale } from "@/contexts/LocaleContext";
import {
  adminFetch,
  fetchGatewayContext,
  fetchKeys,
  fetchState,
} from "@/lib/api";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Chip } from "@/components/ui/Chip";
import { ModelDetailCard } from "@/components/ModelDetailCard";
import { GatewaySetupFlow } from "@/components/GatewaySetupFlow";
import { NoTokenPrompt } from "@/components/NoTokenPrompt";
import type { ByokKey } from "@/types";
import { Info } from "lucide-react";

export function KeysPage() {
  const { token } = useAdminToken();
  const { t, displayError } = useLocale();
  const qc = useQueryClient();
  const [gateway, setGateway] = useState("");
  const [slugManual, setSlugManual] = useState("");
  const [alias, setAlias] = useState("default");
  const [secret, setSecret] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [slugSel, setSlugSel] = useState("");
  const [slugManualFocused, setSlugManualFocused] = useState(false);

  const stateQ = useQuery({
    queryKey: ["state", token],
    queryFn: async () => {
      const r = await fetchState(token);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token),
  });

  const keysQ = useQuery({
    queryKey: ["keys", token, gateway],
    queryFn: async () => {
      const r = await fetchKeys(token, gateway);
      if (!r.ok) throw new Error(r.error);
      return (r.data.result ?? []) as ByokKey[];
    },
    enabled: Boolean(token && gateway),
  });

  const ctxQ = useQuery({
    queryKey: ["gateway-context", token, gateway],
    queryFn: async () => {
      const r = await fetchGatewayContext(token, gateway);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token && gateway),
  });

  const providers = stateQ.data?.providers ?? [];
  const gateways = stateQ.data?.gateways ?? [];

  useEffect(() => {
    if (!gateway && stateQ.data?.defaults.gateway) {
      const id = stateQ.data.defaults.gateway;
      if (gateways.some((g) => g.id === id)) setGateway(id);
    }
  }, [gateway, gateways, stateQ.data?.defaults.gateway]);

  useEffect(() => {
    if (!slugSel && stateQ.data?.defaults.provider_slug) {
      const slug = stateQ.data.defaults.provider_slug;
      if (providers.some((p) => p.slug === slug)) setSlugSel(slug);
    }
  }, [slugSel, providers, stateQ.data?.defaults.provider_slug]);

  const effectiveSlug = slugManual.trim() || slugSel;
  const slugMatch =
    effectiveSlug && providers.some((p) => p.slug === effectiveSlug);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!slugMatch && effectiveSlug) {
        if (!confirm(t("keys.confirmSlug", { slug: effectiveSlug }))) {
          throw new Error(t("common.cancelled"));
        }
      }
      const r = await adminFetch(token, "POST", "/admin/keys", {
        gateway,
        provider_slug: effectiveSlug,
        alias: alias.trim() || "default",
        default_config: isDefault,
        secret: secret.trim(),
      });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success(t("keys.toastSaved"));
      setSecret("");
      setSlugManual("");
      void qc.invalidateQueries({ queryKey: ["keys"] });
      void qc.invalidateQueries({ queryKey: ["gateway-context"] });
    },
    onError: (e) => {
      const msg = displayError(e instanceof Error ? e.message : String(e));
      if (msg.includes("Secrets Store")) {
        toast.error(t("keys.toastNoSecretsPerm"));
      } else if (msg !== t("common.cancelled")) {
        toast.error(msg);
      }
    },
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await adminFetch(
        token,
        "DELETE",
        `/admin/keys?gateway=${encodeURIComponent(gateway)}&id=${encodeURIComponent(id)}`,
      );
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success(t("keys.toastDeleted"));
      void qc.invalidateQueries({ queryKey: ["keys"] });
    },
    onError: (e) => toast.error(displayError(e instanceof Error ? e.message : String(e))),
  });

  if (!token) {
    return <NoTokenPrompt />;
  }

  const d = stateQ.data?.defaults;
  const guideGateway = gateway || d?.gateway || "";
  const guideSlug = effectiveSlug || d?.provider_slug || "";
  const byokForGateway = (keysQ.data?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t("keys.title")}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{t("keys.desc")}</p>
      </div>

      <GatewaySetupFlow
        current="byok"
        collapsible
        callGuide={
          d
            ? {
                gatewayId: guideGateway,
                providerSlug: guideSlug,
                model: ctxQ.data?.routing.model ?? d.model,
                byokConfigured: byokForGateway,
                gatewayAuthenticated:
                  ctxQ.data?.gateway?.authentication ??
                  gateways.find((g) => g.id === guideGateway)?.authentication,
              }
            : undefined
        }
      />

      <Card>
        <label className="mb-1 block text-xs text-[var(--color-muted)]">
          {t("keys.selectGateway")}
        </label>
        <Select
          value={gateway}
          onChange={(e) => setGateway(e.target.value)}
          className="max-w-xs"
        >
          <option value="">{t("keys.selectGatewayPlaceholder")}</option>
          {gateways.map((g) => (
            <option key={g.id} value={g.id}>
              {g.id}
              {g.authentication ? t("keys.authenticatedOpt") : t("keys.unauthenticatedOpt")}
            </option>
          ))}
        </Select>
      </Card>

      {ctxQ.data && (
        <div className="max-w-xl">
          <ModelDetailCard
            modelId={ctxQ.data.routing.model}
            modelMeta={ctxQ.data.model_meta}
            routing={ctxQ.data.routing}
            compact
          />
        </div>
      )}

      <Card>
        <CardTitle>{t("keys.keyList")}</CardTitle>
        {!gateway ? (
          <p className="text-sm text-[var(--color-muted)]">{t("keys.selectGatewayFirst")}</p>
        ) : keysQ.isLoading ? (
          <p className="text-sm text-[var(--color-muted)]">{t("common.loading")}</p>
        ) : (keysQ.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">{t("keys.emptyForGateway")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]">
                <th className="pb-2">provider_slug</th>
                <th className="pb-2">alias</th>
                <th className="pb-2">{t("keys.defaultChip")}</th>
                <th className="pb-2">{t("common.details")}</th>
                <th className="pb-2">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {keysQ.data!.map((k) => (
                <tr
                  key={k.id}
                  className="border-b border-[var(--color-border)]/60"
                >
                  <td className="py-2">
                    <code className="mono">{k.provider_slug}</code>
                  </td>
                  <td className="py-2">{k.alias}</td>
                  <td className="py-2">
                    {k.default_config && <Chip variant="on">{t("keys.defaultChip")}</Chip>}
                  </td>
                  <td className="py-2 text-xs text-[var(--color-muted)]">
                    {k.secret_preview}
                  </td>
                  <td className="py-2">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        if (confirm(t("keys.confirmDelete"))) delMut.mutate(k.id);
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
        <CardTitle>{t("keys.addKey")}</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">
              provider_slug
            </label>
            <Select
              value={slugSel}
              onChange={(e) => setSlugSel(e.target.value)}
            >
              {providers.length === 0 ? (
                <option value="">{t("keys.noProviders")}</option>
              ) : (
                providers.map((p) => (
                  <option key={p.id} value={p.slug}>
                    {p.slug}
                  </option>
                ))
              )}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">
              {t("keys.manualSlug")}
            </label>
            <Input
              value={slugManual}
              onChange={(e) => setSlugManual(e.target.value)}
              onFocus={() => setSlugManualFocused(true)}
              onBlur={() => setSlugManualFocused(false)}
              placeholder={t("keys.manualSlugPlaceholder")}
              className={
                slugManualFocused
                  ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/25"
                  : undefined
              }
            />
            {slugManualFocused && (
              <div
                role="note"
                className="mt-2 flex gap-2.5 rounded-lg border border-[var(--color-accent)]/60 bg-[var(--color-accent)]/15 px-3 py-2.5 shadow-sm"
              >
                <Info
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]"
                  aria-hidden
                />
                <p className="text-sm leading-relaxed text-[var(--color-text)]">
                  <span className="font-medium text-[var(--color-accent)]">
                    {t("keys.manualSlugTitle")}
                  </span>
                  {" — "}
                  {t("keys.manualSlugDesc")}
                </p>
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">alias</label>
            <Input value={alias} onChange={(e) => setAlias(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-muted)]">
              {t("keys.secretValue")}
            </label>
            <Input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
          </div>
        </div>
        {effectiveSlug && (
          <p
            className={`mt-2 text-xs ${slugMatch ? "text-emerald-400" : "text-amber-400"}`}
          >
            {slugMatch
              ? t("keys.slugMatch", { slug: effectiveSlug })
              : t("keys.slugMismatch")}
          </p>
        )}
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          {t("keys.setDefault")}
        </label>
        <Button
          className="mt-4"
          disabled={
            !gateway || !effectiveSlug || !secret.trim() || saveMut.isPending
          }
          onClick={() => saveMut.mutate()}
        >
          {t("keys.addKeyBtn")}
        </Button>
      </Card>
    </div>
  );
}
