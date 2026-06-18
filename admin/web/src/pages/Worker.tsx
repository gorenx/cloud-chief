import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { useWorkerPage } from "@/hooks/useWorkerPage";
import { useWorkerSetupFlowStatus } from "@/hooks/useWorkerSetupFlowStatus";
import { WorkerSetupFlow } from "@/components/worker/WorkerSetupFlow";
import { WorkerSetupWorkspace } from "@/components/worker/WorkerSetupWorkspace";
import { WorkerStepContent } from "@/components/worker/WorkerStepContent";
import { WorkerStepPanelHeader } from "@/components/worker/WorkerStepPanel";
import type { WorkerViewMode } from "@/components/worker/WorkerSetupStepSidebar";
import {
  WORKER_SETUP_STEPS,
  resolveWorkerSetupCurrent,
  type WorkerSetupStep,
} from "@/lib/worker-setup-flow";

export function WorkerPage() {
  const { token } = useAdminToken();
  const page = useWorkerPage(token);
  const [activeStep, setActiveStep] = useState<WorkerViewMode>("project");
  const [activeInit, setActiveInit] = useState(false);

  const varsRecord = useMemo(() => {
    const out: Record<string, string> = {};
    for (const { k, v } of page.vars) {
      if (k.trim()) out[k.trim()] = v;
    }
    return out;
  }, [page.vars]);

  const { flowStatus } = useWorkerSetupFlowStatus({
    token: token ?? "",
    workerDir: page.workerDir,
    status: page.statusQ.data,
    vars: varsRecord,
    secrets: page.secrets,
    prodSet: page.prodSet,
    deployedScriptNames: page.deployedScriptNames,
    matchedOnline: page.matchedOnline,
  });

  useEffect(() => {
    if (activeInit || !page.workerDir) return;
    setActiveStep(resolveWorkerSetupCurrent(flowStatus));
    setActiveInit(true);
  }, [activeInit, page.workerDir, flowStatus]);

  const cfError =
    page.cfDeployedQ.data && !page.cfDeployedQ.data.ok
      ? page.cfDeployedQ.data.error ?? "无法拉取线上列表"
      : page.cfDeployedQ.isError
        ? String(page.cfDeployedQ.error)
        : null;

  const stepDef =
    activeStep !== "all" ? WORKER_SETUP_STEPS.find((s) => s.id === activeStep) : null;

  const rightHeader =
    activeStep === "all" ? (
      <div>
        <h3 className="text-sm font-semibold leading-tight">全部步骤</h3>
        <p className="mt-1 text-xs text-[var(--color-muted)]">纵向浏览各步骤配置</p>
      </div>
    ) : (
      stepDef && <WorkerStepPanelHeader step={stepDef} />
    );

  if (!token) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        请先在 <Link to="/settings" className="text-[var(--color-accent)]">设置</Link> 配置令牌。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Worker 部署</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          通过本机 wrangler 部署边缘代理；密钥经 stdin 传入
        </p>
      </div>

      <WorkerSetupFlow
        flowStatus={flowStatus}
        activeStep={activeStep}
        onGoToStep={setActiveStep}
      />

      <WorkerSetupWorkspace
        status={flowStatus}
        activeStep={activeStep}
        onSelect={setActiveStep}
        onShowAll={() => setActiveStep("all")}
        rightHeader={rightHeader}
      >
        {activeStep === "all" ? (
          <div className="space-y-8">
            {WORKER_SETUP_STEPS.map((def) => (
              <section key={def.id}>
                <div className="mb-4">
                  <WorkerStepPanelHeader step={def} />
                </div>
                <WorkerStepContent
                  step={def.id}
                  token={token}
                  page={page}
                  cfError={cfError}
                />
              </section>
            ))}
          </div>
        ) : (
          stepDef && (
            <WorkerStepContent
              step={activeStep as WorkerSetupStep}
              token={token}
              page={page}
              cfError={cfError}
              embedded
            />
          )
        )}
      </WorkerSetupWorkspace>
    </div>
  );
}
