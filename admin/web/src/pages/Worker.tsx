import { useEffect, useMemo, useState } from "react";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { useLocale } from "@/contexts/LocaleContext";
import { useWorkerPage } from "@/hooks/useWorkerPage";
import { useWorkerSetupFlowStatus } from "@/hooks/useWorkerSetupFlowStatus";
import { WorkerSetupFlow } from "@/components/worker/WorkerSetupFlow";
import { WorkerSetupWorkspace } from "@/components/worker/WorkerSetupWorkspace";
import { WorkerStepContent } from "@/components/worker/WorkerStepContent";
import { WorkerStepPanelHeader } from "@/components/worker/WorkerStepPanel";
import { NoTokenPrompt } from "@/components/NoTokenPrompt";
import type { WorkerViewMode } from "@/components/worker/WorkerSetupStepSidebar";
import { resolveWorkerSetupCurrent, type WorkerSetupStep } from "@/lib/worker-setup-flow";
import { getLocalizedWorkerSteps } from "@/i18n/worker-ui";

export function WorkerPage() {
  const { token } = useAdminToken();
  const { t, displayError } = useLocale();
  const page = useWorkerPage(token);
  const [activeStep, setActiveStep] = useState<WorkerViewMode>("project");
  const [activeInit, setActiveInit] = useState(false);

  const steps = useMemo(() => getLocalizedWorkerSteps(t), [t]);

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
      ? page.cfDeployedQ.data.error ?? t("worker.panel.cfListFailed")
      : page.cfDeployedQ.isError
        ? displayError(
            page.cfDeployedQ.error instanceof Error
              ? page.cfDeployedQ.error.message
              : String(page.cfDeployedQ.error),
          )
        : null;

  const stepDef = activeStep !== "all" ? steps.find((s) => s.id === activeStep) : null;

  const rightHeader =
    activeStep === "all" ? (
      <div>
        <h3 className="text-sm font-semibold leading-tight">{t("worker.page.allSteps")}</h3>
        <p className="mt-1 text-xs text-[var(--color-muted)]">{t("worker.page.allStepsDesc")}</p>
      </div>
    ) : (
      stepDef && <WorkerStepPanelHeader step={stepDef} />
    );

  if (!token) {
    return <NoTokenPrompt />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t("worker.page.title")}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{t("worker.page.desc")}</p>
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
            {steps.map((def) => (
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
