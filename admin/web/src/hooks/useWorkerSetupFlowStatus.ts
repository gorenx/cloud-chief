import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchWorkerBuildsStatus } from "@/lib/api";
import { deriveWorkerSetupStatus, type WorkerManualDeployState } from "@/lib/worker-setup-flow";
import type { WorkerSecretRowState } from "@/lib/worker-config";
import type { WorkerStatus } from "@/types";

export function useWorkerSetupFlowStatus({
  token,
  workerDir,
  status,
  vars,
  secrets,
  prodSet,
  deployedScriptNames,
  matchedOnline,
  manualDeployState,
}: {
  token: string;
  workerDir: string;
  status: WorkerStatus | undefined;
  vars: Record<string, string>;
  secrets: WorkerSecretRowState[];
  prodSet: Set<string> | null;
  deployedScriptNames: Set<string>;
  matchedOnline: boolean;
  manualDeployState?: WorkerManualDeployState;
}) {
  const buildsQ = useQuery({
    queryKey: ["worker-builds", token, workerDir],
    queryFn: async () => {
      const r = await fetchWorkerBuildsStatus(token, workerDir || undefined);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token && workerDir),
    staleTime: 30_000,
  });

  const flowStatus = useMemo(
    () =>
      deriveWorkerSetupStatus({
        workerDir,
        status,
        vars,
        secrets,
        prodSet,
        builds: buildsQ.data,
        deployedScriptNames,
        matchedOnline,
        manualDeployState,
      }),
    [
      workerDir,
      status,
      vars,
      secrets,
      prodSet,
      buildsQ.data,
      deployedScriptNames,
      matchedOnline,
      manualDeployState,
    ],
  );

  return { flowStatus, buildsQ };
}
