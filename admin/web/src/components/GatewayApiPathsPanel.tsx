import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocale } from "@/contexts/LocaleContext";
import {
  fetchGatewayApiPaths,
  saveGatewayApiPaths,
  type GatewayApiPathsResponse,
} from "@/lib/api";
import type { GatewayPathEntry, Provider } from "@/types";
import { Card, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { InvokeUrlCopy } from "./InvokeUrlCopy";
import {
  buildGatewayPathEntries,
  CHAT_API_PATH,
  normalizeGatewayPathSuffix,
  RESPONSES_API_PATH,
} from "@admin/gateway-paths";

function pathKindLabel(
  kind: GatewayPathEntry["kind"],
  t: (k: "gateways.apiPaths.kindChat" | "gateways.apiPaths.kindResponses" | "gateways.apiPaths.kindCustom") => string,
): string {
  if (kind === "chat") return t("gateways.apiPaths.kindChat");
  if (kind === "responses") return t("gateways.apiPaths.kindResponses");
  return t("gateways.apiPaths.kindCustom");
}

function PathInvokeRow({
  invokeUrl,
  upstreamPreview,
  invokeUrlLabel,
}: {
  invokeUrl: string;
  upstreamPreview?: string;
  invokeUrlLabel: string;
}) {
  return (
    <tr className="border-t border-[var(--color-border)]/50 bg-[var(--color-surface-2)]/25">
      <td className="px-2 py-1.5 align-top text-[var(--color-muted)] whitespace-nowrap">
        {invokeUrlLabel}
      </td>
      <td colSpan={2} className="px-2 py-2">
        <InvokeUrlCopy url={invokeUrl} />
        {upstreamPreview && (
          <div className="mono mt-1.5 break-all text-[var(--color-muted)]">
            → {upstreamPreview}
          </div>
        )}
      </td>
    </tr>
  );
}

export function GatewayApiPathsPanel({
  token,
  gateways,
  providers,
  accountId,
  defaultGatewayId,
}: {
  token: string;
  gateways: string[];
  providers: Provider[];
  accountId: string;
  defaultGatewayId?: string;
}) {
  const { t, displayError } = useLocale();
  const qc = useQueryClient();
  const [gatewayId, setGatewayId] = useState(defaultGatewayId ?? "");
  const [providerSlug, setProviderSlug] = useState("");
  const [draftChatSuffix, setDraftChatSuffix] = useState(CHAT_API_PATH);
  const [draftResponsesSuffix, setDraftResponsesSuffix] = useState(RESPONSES_API_PATH);
  const [draftCustom, setDraftCustom] = useState<string[]>([]);
  const [newSuffix, setNewSuffix] = useState("");

  useEffect(() => {
    if (defaultGatewayId) setGatewayId(defaultGatewayId);
  }, [defaultGatewayId]);

  useEffect(() => {
    if (!providerSlug && providers[0]?.slug) setProviderSlug(providers[0].slug);
  }, [providerSlug, providers]);

  const pathsQ = useQuery({
    queryKey: ["gateway-api-paths", token, gatewayId, providerSlug],
    queryFn: async () => {
      const r = await fetchGatewayApiPaths(token, gatewayId, providerSlug);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token && gatewayId && providerSlug),
  });

  useEffect(() => {
    if (pathsQ.data) {
      setDraftChatSuffix(pathsQ.data.chat_suffix);
      setDraftResponsesSuffix(pathsQ.data.responses_suffix);
      setDraftCustom(pathsQ.data.custom_paths);
    }
  }, [pathsQ.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const r = await saveGatewayApiPaths(token, gatewayId, {
        provider_slug: providerSlug,
        chat_suffix: normalizeGatewayPathSuffix(draftChatSuffix) || CHAT_API_PATH,
        responses_suffix: normalizeGatewayPathSuffix(draftResponsesSuffix) || RESPONSES_API_PATH,
        custom_paths: draftCustom,
      });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: (data: GatewayApiPathsResponse) => {
      toast.success(t("gateways.apiPaths.toastSaved"));
      setDraftChatSuffix(data.chat_suffix);
      setDraftResponsesSuffix(data.responses_suffix);
      setDraftCustom(data.custom_paths);
      void qc.invalidateQueries({ queryKey: ["gateway-api-paths", token, gatewayId, providerSlug] });
    },
    onError: (e) => toast.error(displayError(e instanceof Error ? e.message : String(e))),
  });

  const saved = pathsQ.data;
  const chatDirty = saved && draftChatSuffix !== saved.chat_suffix;
  const responsesDirty = saved && draftResponsesSuffix !== saved.responses_suffix;
  const customDirty =
    saved &&
    JSON.stringify([...draftCustom].sort()) !== JSON.stringify([...saved.custom_paths].sort());
  const anyDirty = Boolean(chatDirty || responsesDirty || customDirty);

  const displayPaths = useMemo(() => {
    if (!gatewayId || !providerSlug || !accountId) return [];
    return buildGatewayPathEntries({
      accountId,
      gatewayId,
      providerSlug,
      providerBaseUrl: pathsQ.data?.provider_base_url,
      chatSuffix: draftChatSuffix,
      responsesSuffix: draftResponsesSuffix,
      customSuffixes: draftCustom,
    });
  }, [
    accountId,
    draftChatSuffix,
    draftCustom,
    draftResponsesSuffix,
    gatewayId,
    pathsQ.data?.provider_base_url,
    providerSlug,
  ]);

  const providerBase = pathsQ.data?.provider_base_url ?? "";
  const reservedSuffixes = new Set([
    normalizeGatewayPathSuffix(draftChatSuffix),
    normalizeGatewayPathSuffix(draftResponsesSuffix),
  ]);

  function addCustomSuffix() {
    const suffix = normalizeGatewayPathSuffix(newSuffix);
    if (!suffix) return;
    if (reservedSuffixes.has(suffix)) {
      toast.error(t("gateways.apiPaths.duplicateSuffix"));
      return;
    }
    if (draftCustom.includes(suffix)) return;
    setDraftCustom([...draftCustom, suffix]);
    setNewSuffix("");
  }

  function removeCustomSuffix(suffix: string) {
    setDraftCustom(draftCustom.filter((s) => s !== suffix));
  }

  function setBuiltinSuffix(kind: "chat" | "responses", raw: string) {
    const normalized = normalizeGatewayPathSuffix(raw);
    if (kind === "chat") setDraftChatSuffix(normalized || CHAT_API_PATH);
    else setDraftResponsesSuffix(normalized || RESPONSES_API_PATH);
  }

  function saveSuffixes() {
    saveMut.mutate();
  }

  const builtinRows = displayPaths.filter((p) => p.kind !== "custom");

  return (
    <Card>
      <CardTitle>{t("gateways.apiPaths.title")}</CardTitle>
      <p className="mb-4 text-sm text-[var(--color-muted)]">{t("gateways.apiPaths.desc")}</p>

      <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-[var(--color-muted)]">
        <li>{t("gateways.apiPaths.stepGateway")}</li>
        <li>{t("gateways.apiPaths.stepProvider")}</li>
        <li>{t("gateways.apiPaths.stepPaths")}</li>
      </ol>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-[var(--color-muted)]">
            {t("gateways.gatewayId")}
          </label>
          <select
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            value={gatewayId}
            onChange={(e) => setGatewayId(e.target.value)}
          >
            <option value="">{t("gateways.apiPaths.pickGateway")}</option>
            {gateways.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--color-muted)]">
            provider_slug
          </label>
          <select
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm mono"
            value={providerSlug}
            onChange={(e) => setProviderSlug(e.target.value)}
            disabled={!gatewayId}
          >
            <option value="">{t("gateways.apiPaths.pickProvider")}</option>
            {providers.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.slug}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!gatewayId || !providerSlug ? (
        <p className="text-sm text-[var(--color-muted)]">{t("gateways.apiPaths.selectFirst")}</p>
      ) : pathsQ.isLoading ? (
        <p className="text-sm text-[var(--color-muted)]">{t("common.loading")}</p>
      ) : pathsQ.isError ? (
        <p className="text-sm text-[var(--color-err)]">{displayError(String(pathsQ.error))}</p>
      ) : (
        <div className="space-y-4">
          {providerBase && (
            <p className="mono text-xs break-all text-[var(--color-muted)]">
              base_url: {providerBase}
            </p>
          )}

          <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
            <table className="w-full min-w-[28rem] text-left text-xs">
              <thead className="bg-[var(--color-surface-2)] text-[var(--color-muted)]">
                <tr>
                  <th className="px-2 py-1.5 font-medium">{t("gateways.apiPaths.colKind")}</th>
                  <th className="px-2 py-1.5 font-medium">{t("gateways.apiPaths.colSuffix")}</th>
                  <th className="px-2 py-1.5 font-medium">{t("gateways.apiPaths.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {builtinRows.map((p) => {
                  const rowDirty = p.kind === "chat" ? chatDirty : responsesDirty;
                  return (
                    <Fragment key={p.id}>
                      <tr className="border-t border-[var(--color-border)] align-top">
                        <td className="px-2 py-2 whitespace-nowrap">
                          {pathKindLabel(p.kind, t)}
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            className="mono min-w-[10rem] text-xs"
                            value={p.kind === "chat" ? draftChatSuffix : draftResponsesSuffix}
                            onChange={(e) =>
                              setBuiltinSuffix(p.kind as "chat" | "responses", e.target.value)
                            }
                            placeholder={p.kind === "chat" ? CHAT_API_PATH : RESPONSES_API_PATH}
                          />
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          <Button
                            size="sm"
                            disabled={!rowDirty || saveMut.isPending}
                            onClick={saveSuffixes}
                          >
                            {t("gateways.apiPaths.saveSuffix")}
                          </Button>
                        </td>
                      </tr>
                      <PathInvokeRow
                        invokeUrl={p.invoke_url}
                        upstreamPreview={p.upstream_preview}
                        invokeUrlLabel={t("gateways.apiPaths.invokeUrlLabel")}
                      />
                    </Fragment>
                  );
                })}
                {draftCustom.map((suffix) => {
                  const row = displayPaths.find((p) => p.kind === "custom" && p.suffix === suffix);
                  return (
                    <Fragment key={suffix}>
                      <tr className="border-t border-[var(--color-border)] align-top">
                        <td className="px-2 py-2">{t("gateways.apiPaths.kindCustom")}</td>
                        <td className="mono px-2 py-2">{suffix}</td>
                        <td className="px-2 py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCustomSuffix(suffix)}
                          >
                            {t("common.delete")}
                          </Button>
                        </td>
                      </tr>
                      {row && (
                        <PathInvokeRow
                          invokeUrl={row.invoke_url}
                          upstreamPreview={row.upstream_preview}
                          invokeUrlLabel={t("gateways.apiPaths.invokeUrlLabel")}
                        />
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs text-[var(--color-muted)]">
                {t("gateways.apiPaths.addCustom")}
              </label>
              <Input
                className="mono text-xs"
                placeholder="/embeddings"
                value={newSuffix}
                onChange={(e) => setNewSuffix(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomSuffix();
                  }
                }}
              />
            </div>
            <Button variant="ghost" onClick={addCustomSuffix} disabled={!newSuffix.trim()}>
              {t("gateways.apiPaths.addBtn")}
            </Button>
            {customDirty && (
              <Button disabled={saveMut.isPending} onClick={saveSuffixes}>
                {t("gateways.apiPaths.saveSuffix")}
              </Button>
            )}
          </div>

          {anyDirty && (
            <p className="text-xs text-[var(--color-warn)]">{t("gateways.apiPaths.unsavedHint")}</p>
          )}

          <p className="text-xs text-[var(--color-muted)]">{t("gateways.apiPaths.persistHint")}</p>
        </div>
      )}
    </Card>
  );
}
