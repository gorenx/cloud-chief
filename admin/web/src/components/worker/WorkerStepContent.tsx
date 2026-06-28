import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { WorkerCiCard } from "@/components/worker/WorkerCiCard";
import { WorkerDeployCard } from "@/components/worker/WorkerDeployCard";
import { WorkerOnlineSecretsCard } from "@/components/worker/WorkerOnlineSecretsCard";
import { WorkerOnlineVarsCard } from "@/components/worker/WorkerOnlineVarsCard";
import { WorkerProjectPanel } from "@/components/worker/WorkerProjectPanel";
import { WorkerSecretsCard } from "@/components/worker/WorkerSecretsCard";
import { WorkerVarsCard } from "@/components/worker/WorkerVarsCard";
import type { WorkerSecretRowState, WorkerVarRow } from "@/lib/worker-config";
import type { WorkerSetupStep } from "@/lib/worker-setup-flow";
import type { useSSEStream } from "@/hooks/useSSEStream";
import type { CfDeployedList, CfDeployedWorker, WorkerList, WorkerStatus } from "@/types";

export function WorkerStepContent({
  step,
  token,
  page,
  cfError,
  embedded,
}: {
  step: WorkerSetupStep;
  token: string;
  cfError: string | null;
  embedded?: boolean;
  page: {
    workersQ: UseQueryResult<WorkerList>;
    cfDeployedQ: UseQueryResult<CfDeployedList>;
    workerDir: string;
    deployedScriptNames: Set<string>;
    cfScriptName: string;
    statusQ: UseQueryResult<WorkerStatus>;
    statusAligned: boolean;
    setWorkerDir: (dir: string) => void;
    setCfScriptName: (name: string) => void;
    refreshLists: () => void;
    vars: WorkerVarRow[];
    setVars: (rows: WorkerVarRow[]) => void;
    varsSave: UseMutationResult<void, Error, void, unknown>;
    cfVarsSync: UseMutationResult<
      { ok: true; script_name: string; updated_keys: string[] },
      Error,
      void,
      unknown
    >;
    varsOutOfSync: boolean;
    varsUnsaved: boolean;
    onlineScript: CfDeployedWorker | null;
    matchedOnline: boolean;
    secrets: WorkerSecretRowState[];
    localSet: Set<string>;
    prodSet: Set<string> | null;
    setSecrets: (rows: WorkerSecretRowState[]) => void;
    devVarsSave: UseMutationResult<void, Error, void, unknown>;
    secretsPush: UseMutationResult<void, Error, void, unknown>;
    deploy: ReturnType<typeof useSSEStream>;
    startDeploy: () => void;
    refreshStatus: () => void;
  };
}) {
  if (step === "project") {
    return (
      <WorkerProjectPanel
        workersQ={page.workersQ}
        cfDeployedQ={page.cfDeployedQ}
        workerDir={page.workerDir}
        deployedScriptNames={page.deployedScriptNames}
        cfScriptName={page.cfScriptName}
        status={page.statusQ.data}
        onCfScriptNameChange={page.setCfScriptName}
        embedded={embedded}
      />
    );
  }

  if (step === "vars") {
    return (
      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <WorkerVarsCard
          vars={page.vars}
          onChange={page.setVars}
          onSave={() => page.varsSave.mutate()}
          save={page.varsSave}
          onSyncCf={() => page.cfVarsSync.mutate()}
          cfSync={page.cfVarsSync}
          canSyncCf={page.matchedOnline}
          varsOutOfSync={page.varsOutOfSync}
          varsUnsaved={page.varsUnsaved}
        />
        <WorkerOnlineVarsCard
          script={page.statusAligned ? page.onlineScript : null}
          localVars={page.statusAligned ? page.vars : undefined}
          matched={page.matchedOnline}
          loading={
            page.cfDeployedQ.isLoading ||
            page.statusQ.isFetching ||
            !page.statusAligned
          }
          error={cfError}
        />
      </div>
    );
  }

  if (step === "secrets") {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <WorkerSecretsCard
          secrets={page.secrets}
          localSet={page.localSet}
          prodSet={page.prodSet}
          onChange={page.setSecrets}
          onSaveDevVars={() => page.devVarsSave.mutate()}
          onPushSecrets={() => page.secretsPush.mutate()}
          devVarsSave={page.devVarsSave}
          secretsPush={page.secretsPush}
        />
        <WorkerOnlineSecretsCard
          script={page.statusAligned ? page.onlineScript : null}
          prodSet={page.prodSet}
          loading={
            page.cfDeployedQ.isLoading ||
            page.statusQ.isFetching ||
            !page.statusAligned
          }
          error={cfError}
        />
      </div>
    );
  }

  if (step === "ci") {
    return (
      <WorkerCiCard
        token={token}
        workerDir={page.workerDir}
        wranglerName={page.statusQ.data?.worker_name ?? null}
      />
    );
  }

  return (
    <WorkerDeployCard
      deploy={page.deploy}
      onDeploy={page.startDeploy}
      onRefresh={page.refreshStatus}
      embedded={embedded}
    />
  );
}
