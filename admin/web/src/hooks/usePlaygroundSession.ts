import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  fetchGatewayContext,
  fetchGatewayApiPaths,
  fetchPublicConfig,
  fetchSupabaseStatus,
  fetchWorkerList,
  startWorkerDev,
} from "@/lib/api";
import { buildGatewayPathEntries, CHAT_API_PATH } from "@admin/gateway-paths";
import type { GatewayPathEntry } from "@/types";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { useLocale } from "@/contexts/LocaleContext";
import {
  DEBUG_TAB_KEY,
  deriveSessionFlags,
  readDebugTab,
  readWorkerEndpoint,
  persistWorkerEndpoint,
  parseWorkerEndpoint,
  WORKER_ENDPOINT_LOCAL,
  resolveEffectiveGateway,
  resolveEffectiveModel,
  resolveInspectTarget,
  resolveRequestPath,
  resolveWorkerDisplayUrl,
  resolveWorkerTierModels,
  readGatewayApiPath,
  persistGatewayApiPath,
  type DebugTab,
  type WorkerConfigSource,
  type WorkerTarget,
} from "@/lib/playground-session";
import { resolvePlaygroundDataView } from "@/lib/playground-sources";
import { playgroundRouting } from "@/lib/routing";
import { pickFields } from "@/lib/field-meta";
import { toast } from "sonner";

const WORKER_DIR_KEY = "admin-playground-worker-dir";

function readStoredWorkerDir(): string {
  try {
    return localStorage.getItem(WORKER_DIR_KEY) ?? "";
  } catch {
    return "";
  }
}

function persistTab(tab: DebugTab) {
  try {
    localStorage.setItem(DEBUG_TAB_KEY, tab);
  } catch {
    /* ignore */
  }
}

export function usePlaygroundSession() {
  const { token } = useAdminToken();
  const { t, displayError } = useLocale();
  const [activeTab, setActiveTabState] = useState<DebugTab>(readDebugTab);
  const [workerConfigSource, setWorkerConfigSource] =
    useState<WorkerConfigSource>("worker");
  const [workerTarget, setWorkerTargetState] = useState<WorkerTarget>(readWorkerEndpoint);

  const setWorkerTarget = useCallback((endpoint: WorkerTarget) => {
    const parsed = parseWorkerEndpoint(endpoint);
    setWorkerTargetState(parsed);
    persistWorkerEndpoint(parsed);
  }, []);
  const [workerDir, setWorkerDirState] = useState(readStoredWorkerDir);
  const [gateway, setGateway] = useState("");
  const [uiModel, setUiModel] = useState("");
  const [workerAccessToken, setWorkerAccessToken] = useState("");
  const [workerTestEmail, setWorkerTestEmail] = useState("");
  const [workerTestPassword, setWorkerTestPassword] = useState("");
  const [workerHealthChecking, setWorkerHealthChecking] = useState(false);
  const [workerHealthResult, setWorkerHealthResult] = useState<string | null>(null);
  const [gatewayApiPath, setGatewayApiPathState] = useState(readGatewayApiPath);

  const setGatewayApiPath = useCallback((path: string) => {
    setGatewayApiPathState(path);
    persistGatewayApiPath(path);
  }, []);

  const setActiveTab = useCallback((tab: DebugTab) => {
    setActiveTabState(tab);
    persistTab(tab);
  }, []);

  const setWorkerDir = useCallback((dir: string) => {
    setWorkerDirState(dir);
    setWorkerHealthResult(null);
    try {
      if (dir) localStorage.setItem(WORKER_DIR_KEY, dir);
      else localStorage.removeItem(WORKER_DIR_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const inspectTarget = resolveInspectTarget(activeTab);
  const requestPath = resolveRequestPath(activeTab);
  const effectiveWorkerConfigSource: WorkerConfigSource =
    activeTab === "worker" ? workerConfigSource : "ui";

  const workersQ = useQuery({
    queryKey: ["worker-list", token],
    queryFn: async () => {
      const r = await fetchWorkerList(token);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token),
  });

  const workers = workersQ.data?.workers ?? [];
  const effectiveWorkerDir =
    workerDir || workersQ.data?.default || workers[0]?.dir || "";

  useEffect(() => {
    if (!workersQ.data || workers.length === 0) return;
    setWorkerDirState((prev) => {
      if (prev && workers.some((w) => w.dir === prev)) return prev;
      const stored = readStoredWorkerDir();
      if (stored && workers.some((w) => w.dir === stored)) return stored;
      return workersQ.data.default;
    });
  }, [workersQ.data, workers]);

  const configQ = useQuery({
    queryKey: ["public-config", effectiveWorkerDir],
    queryFn: async () => {
      const r = await fetchPublicConfig(effectiveWorkerDir || undefined);
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
  const workerCapabilities = config?.worker?.capabilities ?? null;
  const flags = deriveSessionFlags(
    inspectTarget,
    effectiveWorkerConfigSource,
    workerCapabilities,
  );
  const effectiveModel = resolveEffectiveModel(config, uiModel, flags);
  const workerTierModels = resolveWorkerTierModels(config);
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
    () => resolvePlaygroundDataView(inspectTarget, flags, pickFields(config?._meta), t),
    [inspectTarget, flags, config?._meta, t],
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
    const endpoints = config?.worker.url_endpoints;
    if (!endpoints?.length) return;
    setWorkerTargetState((prev) => {
      const parsed = parseWorkerEndpoint(prev);
      if (endpoints.some((e) => e.id === parsed)) return parsed;
      return WORKER_ENDPOINT_LOCAL;
    });
  }, [config?.worker.url_endpoints]);

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
  const routing =
    config && !flags.hideGatewayModel
      ? playgroundRouting(config, effectiveGateway, effectiveModel, gatewayApiPath)
      : null;

  const providerSlug = routing?.provider_slug ?? config?.provider_slug ?? "";

  const gatewayPathsQ = useQuery({
    queryKey: ["playground-gateway-paths", token, effectiveGateway, providerSlug],
    queryFn: async () => {
      const r = await fetchGatewayApiPaths(token, effectiveGateway, providerSlug);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token && effectiveGateway && providerSlug),
  });

  const gatewayPathOptions: GatewayPathEntry[] = useMemo(() => {
    if (gatewayPathsQ.data?.paths.length) return gatewayPathsQ.data.paths;
    const accountId = config?.worker_routing?.account_id ?? "";
    if (!accountId || !effectiveGateway || !providerSlug) return [];
    return buildGatewayPathEntries({
      accountId,
      gatewayId: effectiveGateway,
      providerSlug,
      providerBaseUrl: config?.base_url,
    });
  }, [
    config?.base_url,
    config?.worker_routing?.account_id,
    effectiveGateway,
    gatewayPathsQ.data,
    providerSlug,
  ]);

  useEffect(() => {
    if (!gatewayPathOptions.length) return;
    const suffixes = gatewayPathOptions.map((p) => p.suffix);
    if (gatewayApiPath && suffixes.includes(gatewayApiPath)) return;
    const chat = gatewayPathOptions.find((p) => p.kind === "chat");
    setGatewayApiPath(chat?.suffix ?? suffixes[0] ?? CHAT_API_PATH);
  }, [gatewayApiPath, gatewayPathOptions, setGatewayApiPath]);

  const startLocalDevM = useMutation({
    mutationFn: async () => {
      const r = await startWorkerDev(token, effectiveWorkerDir || undefined);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: (data) => {
      toast.success(
        data.already_running ? t("playground.workerAlreadyRunning") : t("playground.workerStarted"),
      );
      void checkWorkerHealth();
    },
    onError: (e: Error) => toast.error(displayError(e.message)),
  });

  async function checkWorkerHealth() {
    setWorkerHealthChecking(true);
    setWorkerHealthResult(null);
    try {
      const params = new URLSearchParams({ target: workerTarget });
      if (effectiveWorkerDir) params.set("dir", effectiveWorkerDir);
      const r = await fetch(`/api/worker-chat/health?${params}`);
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
    activeTab,
    setActiveTab,
    requestPath,
    inspectTarget,
    config,
    flags,
    workerCapabilities,
    workerConfigSource,
    setWorkerConfigSource,
    workerTarget,
    setWorkerTarget,
    workerDir: effectiveWorkerDir,
    setWorkerDir,
    workers,
    workersLoading: workersQ.isLoading,
    effectiveWorkerUrl,
    gateway,
    setGateway,
    uiModel,
    setUiModel,
    effectiveModel,
    workerTierModels,
    effectiveGateway,
    gatewayApiPath,
    setGatewayApiPath,
    gatewayPathOptions,
    gatewayPathsLoading: gatewayPathsQ.isLoading,
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
