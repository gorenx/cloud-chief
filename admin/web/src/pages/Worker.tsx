import { Link } from "react-router-dom";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { useWorkerPage } from "@/hooks/useWorkerPage";
import { WorkerDeployCard } from "@/components/worker/WorkerDeployCard";
import { WorkerOnlineSecretsCard } from "@/components/worker/WorkerOnlineSecretsCard";
import { WorkerOnlineVarsCard } from "@/components/worker/WorkerOnlineVarsCard";
import { WorkerProjectPanel } from "@/components/worker/WorkerProjectPanel";
import { WorkerSecretsCard } from "@/components/worker/WorkerSecretsCard";
import { WorkerVarsCard } from "@/components/worker/WorkerVarsCard";

export function WorkerPage() {
  const { token } = useAdminToken();
  const page = useWorkerPage(token);

  const cfError =
    page.cfDeployedQ.data && !page.cfDeployedQ.data.ok
      ? page.cfDeployedQ.data.error ?? "无法拉取线上列表"
      : page.cfDeployedQ.isError
        ? String(page.cfDeployedQ.error)
        : null;

  if (!token) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        请先在 <Link to="/settings" className="text-[var(--color-accent)]">设置</Link> 配置令牌。
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Worker 部署</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          通过本机 wrangler 部署边缘代理；密钥经 stdin 传入
        </p>
      </div>

      <WorkerProjectPanel
        workersQ={page.workersQ}
        cfDeployedQ={page.cfDeployedQ}
        workerDir={page.workerDir}
        deployedScriptNames={page.deployedScriptNames}
        cfScriptName={page.cfScriptName}
        status={page.statusQ.data}
        onSelectDir={page.setWorkerDir}
        onCfScriptNameChange={page.setCfScriptName}
        onRefresh={page.refreshLists}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <WorkerVarsCard
          vars={page.vars}
          onChange={page.setVars}
          onSave={() => page.varsSave.mutate()}
          save={page.varsSave}
        />
        <WorkerOnlineVarsCard
          script={page.onlineScript}
          compareVars={page.localVarsRecord}
          matched={page.matchedOnline}
          loading={page.cfDeployedQ.isLoading}
          error={cfError}
        />
      </div>

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
          script={page.onlineScript}
          prodSet={page.prodSet}
          loading={page.cfDeployedQ.isLoading}
          error={cfError}
        />
      </div>

      <WorkerDeployCard
        deploy={page.deploy}
        onDeploy={page.startDeploy}
        onRefresh={page.refreshStatus}
      />
    </div>
  );
}
