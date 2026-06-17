import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchGatewayContext, fetchPublicConfig, fetchSupabaseStatus, startWorkerDev } from "@/lib/api";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import type { WorkerConfigSource } from "@/lib/playground-session";
import { playgroundRouting } from "@/lib/routing";
import {
  deriveSessionFlags,
  resolveEffectiveGateway,
  resolveEffectiveModel,
  resolveWorkerDisplayUrl,
  type CallMode,
  type WorkerTarget,
} from "@/lib/playground-session";
import { resolvePlaygroundDataView } from "@/lib/playground-sources";
import { pickFields } from "@/lib/field-meta";
import { toast } from "sonner";

export function usePlaygroundSession() {
  const { token } = useAdminToken();
  const [callMode, setCallMode] = useState<CallMode>("gateway");
  const [workerConfigSource, setWorkerConfigSource] =
    useState<WorkerConfigSource>("worker");
  const [workerTarget, setWorkerTarget] = useState<WorkerTarget>("local");
  const [gateway, setGateway] = useState("");
  const [uiModel, setUiModel] = useState("");
  const [workerAccessToken, setWorkerAccessToken] = useState("");
  const [workerTestEmail, setWorkerTestEmail] = useState("");
  const [workerTestPassword, setWorkerTestPassword] = useState("");
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

  const supabaseStatusQ = useQuery({
    queryKey: ["supabase-status", token],
    queryFn: async () => {
      const r = await fetchSupabaseStatus(token);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token),
  });

  const testEmailInitialized = useRef(false);

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

  useEffect(() => {
    if (testEmailInitialized.current || !supabaseStatusQ.isSuccess) return;
    const email = supabaseStatusQ.data?.local_test?.email;
    if (email) setWorkerTestEmail(email);
    testEmailInitialized.current = true;
  }, [supabaseStatusQ.isSuccess, supabaseStatusQ.data]);

  useEffect(() => {
    if (config && !config.worker.online_available) {
      setWorkerTarget((t) => (t === "online" ? "local" : t));
    }
  }, [config?.worker.online_available]);

  const effectiveWorkerUrl = resolveWorkerDisplayUrl(config?.worker ?? null, workerTarget);

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

  const startLocalDevM = useMutation({
    mutationFn: async () => {
      const r = await startWorkerDev(token);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: (data) => {
      toast.success(
        data.already_running ? "本地 Worker 已在运行" : "本地 Worker 已启动（:8788）",
      );
      void checkWorkerHealth();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function checkWorkerHealth() {
    setWorkerHealthChecking(true);
    setWorkerHealthResult(null);
    try {
      const r = await fetch(`/api/worker-chat/health?target=${workerTarget}`);
      const j = (await r.json()) as {
        ok?: boolean;
        body?: string;
        error?: string;
        status?: number;
        worker_url?: string;
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
    workerTarget,
    setWorkerTarget,
    effectiveWorkerUrl,
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
    workerTestEmail,
    setWorkerTestEmail,
    workerTestPassword,
    setWorkerTestPassword,
    workerHealthChecking,
    workerHealthResult,
    checkWorkerHealth,
    startLocalDev: () => startLocalDevM.mutate(),
    startingLocalDev: startLocalDevM.isPending,
    catalogSynced: config?.catalog_synced ?? [],
    refetchConfig: () => configQ.refetch(),
  };
}
