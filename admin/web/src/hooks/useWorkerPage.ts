import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminFetch,
  fetchCfDeployedWorkers,
  fetchWorkerList,
  fetchWorkerSecrets,
  fetchWorkerStatus,
} from "@/lib/api";
import {
  buildVarsObject,
  collectWorkerSecrets,
  type WorkerSecretRowState,
  type WorkerVarRow,
} from "@/lib/worker-config";
import { useSSEStream } from "@/hooks/useSSEStream";
import { useLocale } from "@/contexts/LocaleContext";
import type { WorkerStatus } from "@/types";

export function useWorkerPage(token: string) {
  const { t, displayError } = useLocale();
  const qc = useQueryClient();
  const [workerDir, setWorkerDir] = useState("");
  const [vars, setVars] = useState<WorkerVarRow[]>([{ k: "", v: "" }]);
  const [secrets, setSecrets] = useState<WorkerSecretRowState[]>([]);
  const [prodSet, setProdSet] = useState<Set<string> | null>(null);
  const deploy = useSSEStream();

  const workersQ = useQuery({
    queryKey: ["worker-list", token],
    queryFn: async () => {
      const r = await fetchWorkerList(token);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token),
  });

  const cfDeployedQ = useQuery({
    queryKey: ["worker-cf-deployed", token],
    queryFn: async () => {
      const r = await fetchCfDeployedWorkers(token);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token),
  });

  const deployedScriptNames = useMemo(
    () => new Set((cfDeployedQ.data?.scripts ?? []).map((s) => s.name)),
    [cfDeployedQ.data?.scripts],
  );

  useEffect(() => {
    if (workersQ.data && !workerDir) {
      setWorkerDir(workersQ.data.default);
    }
  }, [workersQ.data, workerDir]);

  const wq = workerDir ? `?dir=${encodeURIComponent(workerDir)}` : "";

  const statusQ = useQuery({
    queryKey: ["worker-status", token, workerDir],
    queryFn: async () => {
      const r = await fetchWorkerStatus(token, workerDir || undefined);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token && workerDir),
  });

  useEffect(() => {
    const s = statusQ.data;
    if (!s) return;
    syncFormFromStatus(s, token, workerDir, setVars, setSecrets, setProdSet);
  }, [statusQ.data, token, workerDir]);

  const varsSave = useMutation({
    mutationFn: async () => {
      const obj = buildVarsObject(vars, t);
      const r = await adminFetch(token, "PUT", `/admin/worker/config${wq}`, { vars: obj });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success(t("worker.toast.varsSaved"));
      void qc.invalidateQueries({ queryKey: ["worker-status"] });
    },
    onError: (e) => toast.error(displayError(e instanceof Error ? e.message : String(e))),
  });

  const devVarsSave = useMutation({
    mutationFn: async () => {
      const obj = collectWorkerSecrets(secrets, t);
      if (!obj || Object.keys(obj).length === 0) throw new Error(t("worker.toast.noSecretValues"));
      const r = await adminFetch(token, "PUT", `/admin/worker/devvars${wq}`, { secrets: obj });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => toast.success(t("worker.toast.devVarsSaved")),
    onError: (e) => toast.error(displayError(e instanceof Error ? e.message : String(e))),
  });

  const secretsPush = useMutation({
    mutationFn: async () => {
      const obj = collectWorkerSecrets(secrets, t);
      if (!obj || Object.keys(obj).length === 0) throw new Error(t("worker.toast.noSecretValues"));
      for (const [name, value] of Object.entries(obj)) {
        const r = await adminFetch(token, "POST", `/admin/worker/secret${wq}`, { name, value });
        if (!r.ok) throw new Error(t("worker.toast.pushFailed", { name, error: r.error }));
      }
    },
    onSuccess: () => toast.success(t("worker.toast.secretsPushed")),
    onError: (e) => toast.error(displayError(e instanceof Error ? e.message : String(e))),
  });

  function refreshLists() {
    void qc.invalidateQueries({ queryKey: ["worker-status"] });
    void qc.invalidateQueries({ queryKey: ["worker-cf-deployed"] });
    void qc.invalidateQueries({ queryKey: ["worker-list"] });
  }

  function refreshStatus() {
    void qc.invalidateQueries({ queryKey: ["worker-status"] });
    void qc.invalidateQueries({ queryKey: ["worker-cf-deployed"] });
  }

  function startDeploy() {
    deploy.setLines([]);
    void deploy.start(`/admin/worker/deploy${wq}`, {
      headers: { Authorization: `Bearer ${token}` },
      onEvent: (e) => {
        if (e.event === "done") {
          toast.success(
            e.data === "0" ? t("worker.toast.deploySuccess") : t("worker.toast.deployExit", { code: e.data }),
          );
          refreshStatus();
        }
        if (e.event === "error") toast.error(e.data);
      },
    });
  }

  const localSet = useMemo(
    () => new Set(statusQ.data?.local_secrets ?? []),
    [statusQ.data?.local_secrets],
  );

  const cfScripts = cfDeployedQ.data?.ok ? cfDeployedQ.data.scripts : [];
  const [cfScriptName, setCfScriptName] = useState("");
  const prevWorkerDirRef = useRef(workerDir);

  useEffect(() => {
    const localName = statusQ.data?.worker_name;
    const workerDirChanged = prevWorkerDirRef.current !== workerDir;
    prevWorkerDirRef.current = workerDir;

    const pickLocalMatch = () => {
      if (localName && cfScripts.some((s) => s.name === localName)) {
        setCfScriptName(localName);
        return;
      }
      setCfScriptName("");
    };

    if (workerDirChanged) {
      pickLocalMatch();
      return;
    }

    if (!cfScriptName) {
      pickLocalMatch();
      return;
    }

    if (!cfScripts.some((s) => s.name === cfScriptName)) {
      pickLocalMatch();
    }
  }, [statusQ.data?.worker_name, cfScripts, workerDir, cfScriptName]);

  const onlineScript = useMemo(
    () => cfScripts.find((s) => s.name === cfScriptName) ?? null,
    [cfScripts, cfScriptName],
  );

  const localVarsRecord = useMemo(() => {
    const out: Record<string, string> = {};
    for (const { k, v } of vars) {
      if (k.trim()) out[k.trim()] = v;
    }
    return out;
  }, [vars]);

  const matchedOnline =
    Boolean(statusQ.data?.worker_name) &&
    onlineScript?.name === statusQ.data?.worker_name;

  return {
    workerDir,
    setWorkerDir,
    workersQ,
    cfDeployedQ,
    statusQ,
    deployedScriptNames,
    vars,
    setVars,
    secrets,
    setSecrets,
    prodSet,
    localSet,
    cfScriptName,
    setCfScriptName,
    onlineScript,
    localVarsRecord,
    matchedOnline,
    varsSave,
    devVarsSave,
    secretsPush,
    deploy,
    refreshLists,
    refreshStatus,
    startDeploy,
  };
}

function syncFormFromStatus(
  s: WorkerStatus,
  token: string,
  workerDir: string,
  setVars: (rows: WorkerVarRow[]) => void,
  setSecrets: (rows: WorkerSecretRowState[]) => void,
  setProdSet: (set: Set<string> | null) => void,
) {
  const entries = Object.entries(s.vars);
  setVars(entries.length ? entries.map(([k, v]) => ({ k, v })) : [{ k: "", v: "" }]);

  const seen = new Set<string>();
  const rows: WorkerSecretRowState[] = [];
  for (const sec of s.secrets) {
    seen.add(sec.name);
    rows.push({
      name: sec.name,
      value: s.dev_vars[sec.name] ?? "",
      fixed: true,
      optional: sec.optional,
    });
  }
  for (const [k, v] of Object.entries(s.dev_vars)) {
    if (!seen.has(k)) rows.push({ name: k, value: v, fixed: false, optional: false });
  }
  if (rows.length === 0) rows.push({ name: "", value: "", fixed: false, optional: false });
  setSecrets(rows);

  if (s.logged_in) {
    void fetchWorkerSecrets(token, workerDir || undefined).then((r) => {
      if (r.ok) setProdSet(new Set(r.data.names));
    });
  }
}
