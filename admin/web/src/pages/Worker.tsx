import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { useLocale } from "@/contexts/LocaleContext";
import { useWorkerPage } from "@/hooks/useWorkerPage";
import { useWorkerSetupFlowStatus } from "@/hooks/useWorkerSetupFlowStatus";
import { WorkerSetupFlow } from "@/components/worker/WorkerSetupFlow";
import { WorkerSetupWorkspace } from "@/components/worker/WorkerSetupWorkspace";
import { WorkerStepContent } from "@/components/worker/WorkerStepContent";
import { WorkerStepPanelHeader } from "@/components/worker/WorkerStepPanel";
import { NoTokenPrompt } from "@/components/NoTokenPrompt";
import { PageHeader } from "@/components/ui/PageHeader";
import type { WorkerViewMode } from "@/components/worker/WorkerSetupStepSidebar";
import { resolveWorkerSetupCurrent, type WorkerSetupStep } from "@/lib/worker-setup-flow";
import { getLocalizedWorkerSteps } from "@/i18n/worker-ui";
import { useScrollContainer } from "@/contexts/ScrollContainerContext";
import {
  pinScrollTop,
  readMainScrollTop,
  resetWizardMainScroll,
  restoreMainScrollTop,
  setFlowInert,
} from "@/lib/prevent-nav-scroll";

export function WorkerPage() {
  const { token } = useAdminToken();
  const { t, displayError } = useLocale();
  const page = useWorkerPage(token);
  const scrollRef = useScrollContainer();
  const flowRef = useRef<HTMLDivElement>(null);
  const pinStop = useRef<(() => void) | null>(null);
  const [activeStep, setActiveStep] = useState<WorkerViewMode>("project");
  const [activeInit, setActiveInit] = useState(false);
  const pendingScrollTop = useRef<number | null>(null);

  const selectStep = useCallback(
    (step: WorkerViewMode) => {
      pinStop.current?.();
      pendingScrollTop.current = readMainScrollTop(scrollRef);
      resetWizardMainScroll(scrollRef);
      setFlowInert(flowRef.current, true);
      pinStop.current = pinScrollTop(pendingScrollTop.current, scrollRef);
      setActiveStep(step);
    },
    [scrollRef],
  );

  useLayoutEffect(() => {
    if (pendingScrollTop.current === null) return;
    restoreMainScrollTop(pendingScrollTop.current, scrollRef);
    pendingScrollTop.current = null;
  }, [activeStep, scrollRef]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      pinStop.current?.();
      pinStop.current = null;
      setFlowInert(flowRef.current, false);
    }, 600);
    return () => clearTimeout(id);
  }, [activeStep]);

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
  const workerName = page.displayWorkerName;

  const rightHeader =
    activeStep === "all" ? (
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h3 className="text-sm font-semibold leading-tight">{t("worker.page.allSteps")}</h3>
        <p className="max-w-[min(24rem,100%)] shrink-0 text-right text-xs text-[var(--color-muted)] sm:max-w-[min(24rem,45%)]">
          {t("worker.page.allStepsDesc")}
        </p>
      </div>
    ) : (
      stepDef && <WorkerStepPanelHeader step={stepDef} workerName={workerName} />
    );

  if (!token) {
    return <NoTokenPrompt />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("worker.page.title")} description={t("worker.page.desc")} />

      <WorkerSetupFlow
        ref={flowRef}
        flowStatus={flowStatus}
        activeStep={activeStep}
        onGoToStep={selectStep}
      />

      <WorkerSetupWorkspace
        status={flowStatus}
        activeStep={activeStep}
        onSelect={selectStep}
        onShowAll={() => selectStep("all")}
        rightHeader={rightHeader}
        scrollMain
      >
        {activeStep === "all" ? (
          <div className="space-y-8">
            {steps.map((def) => (
              <section key={def.id}>
                <div className="mb-4">
                  <WorkerStepPanelHeader step={def} workerName={workerName} />
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
