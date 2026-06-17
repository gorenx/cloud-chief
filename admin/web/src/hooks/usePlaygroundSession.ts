import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchGatewayContext, fetchPublicConfig } from "@/lib/api";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import type { WorkerConfigSource } from "@/lib/playground-session";
import { playgroundRouting } from "@/lib/routing";
import {
  deriveSessionFlags,
  resolveEffectiveGateway,
  resolveEffectiveModel,
  type CallMode,
} from "@/lib/playground-session";
import { resolvePlaygroundDataView } from "@/lib/playground-sources";
import { pickFields } from "@/lib/field-meta";

export function usePlaygroundSession() {
  const { token } = useAdminToken();
  const [callMode, setCallMode] = useState<CallMode>("gateway");
  const [workerConfigSource, setWorkerConfigSource] =
    useState<WorkerConfigSource>("worker");
  const [gateway, setGateway] = useState("");
  const [uiModel, setUiModel] = useState("");
  const [workerAccessToken, setWorkerAccessToken] = useState("");
  const [workerHealthChecking, setWorkerHealthChecking] = useState(false);
  const [workerHealthResult, setWorkerHealthResult] = useState<string | null>(null);

  const configQ = useQuery({
    queryKey: ["public-config"],
    queryFn: async () => {
      const r = await fetchPublicConfig();
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
  });

  const config = configQ.data ?? null;
  const flags = deriveSessionFlags(callMode, workerConfigSource);
  const effectiveModel = resolveEffectiveModel(config, uiModel, flags.useWorkerToml);
  const effectiveGateway = resolveEffectiveGateway(config, gateway, flags.useWorkerToml);
  const catalogRefetched = useRef(false);

  useEffect(() => {
    if (!config || !effectiveModel) return;
    if (config.models.some((m) => m.id === effectiveModel)) {
      catalogRefetched.current = false;
      return;
    }
    if (catalogRefetched.current) return;
    catalogRefetched.current = true;
    void configQ.refetch();
  }, [config, effectiveModel, configQ]);
  const dataView = useMemo(
    () =>
      resolvePlaygroundDataView(
        deriveSessionFlags(callMode, workerConfigSource),
        pickFields(config?._meta),
      ),
    [callMode, workerConfigSource, config?._meta],
  );

  useEffect(() => {
    if (!config) return;
    setGateway(config.gateway);
    setUiModel(config.model);
  }, [config]);

  const gatewayCtxQ = useQuery({
    queryKey: ["gateway-context", token, gateway],
    queryFn: async () => {
      const r = await fetchGatewayContext(token, gateway);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token && gateway && dataView.showGatewayContext),
  });

  const modelMeta = config?.models.find((m) => m.id === effectiveModel) ?? null;
  const routing = config
    ? playgroundRouting(config, effectiveGateway, effectiveModel)
    : null;

  async function checkWorkerHealth() {
    setWorkerHealthChecking(true);
    setWorkerHealthResult(null);
    try {
      const r = await fetch("/api/worker-chat/health");
      const j = (await r.json()) as {
        ok?: boolean;
        body?: string;
        error?: string;
        status?: number;
      };
      if (j.ok) setWorkerHealthResult(`ok (${j.body ?? "—"})`);
      else setWorkerHealthResult(j.error ?? `HTTP ${j.status ?? r.status}`);
    } catch (e) {
      setWorkerHealthResult((e as Error).message);
    } finally {
      setWorkerHealthChecking(false);
    }
  }

  return {
    token,
    config,
    flags,
    callMode,
    setCallMode,
    workerConfigSource,
    setWorkerConfigSource,
    gateway,
    setGateway,
    uiModel,
    setUiModel,
    effectiveModel,
    effectiveGateway,
    modelMeta,
    routing,
    fieldMeta: config?._meta?.fields,
    dataView,
    gatewayContext: gatewayCtxQ.data ?? null,
    gatewayContextLoading: gatewayCtxQ.isLoading,
    workerAccessToken,
    setWorkerAccessToken,
    workerHealthChecking,
    workerHealthResult,
    checkWorkerHealth,
    catalogSynced: config?.catalog_synced ?? [],
    refetchConfig: () => configQ.refetch(),
  };
}
