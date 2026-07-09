import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { useLocale } from "@/contexts/LocaleContext";
import { useWorkerPage } from "@/hooks/useWorkerPage";
import { useWorkerSetupFlowStatus } from "@/hooks/useWorkerSetupFlowStatus";
import { WorkerSetupFlow } from "@/components/worker/WorkerSetupFlow";
import { WorkerSetupWorkspace } from "@/components/worker/WorkerSetupWorkspace";
import { WorkerSidebarProjectBar } from "@/components/worker/WorkerSidebarProjectBar";
import { WorkerStepContent } from "@/components/worker/WorkerStepContent";
import { WorkerStepHeader } from "@/components/worker/WorkerStepHeader";
import { NoTokenPrompt } from "@/components/NoTokenPrompt";
import { PageHeader } from "@/components/ui/PageHeader";
import type { WorkerViewMode } from "@/components/worker/WorkerSetupWorkspace";
import { resolveWorkerSetupCurrent, type WorkerSetupStep } from "@/lib/worker-setup-flow";
import { getLocalizedWorkerSteps } from "@/i18n/worker-ui";
import { useScrollContainer } from "@/contexts/ScrollContainerContext";
import {
  flashFlowInert,
  pinScrollTop,
  readMainScrollTop,
  resetWizardMainScroll,
  restoreMainScrollTop,
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
  const flowInertClear = useRef<(() => void) | null>(null);

  const selectStep = useCallback(
    (step: WorkerViewMode) => {
      pinStop.current?.();
      pendingScrollTop.current = readMainScrollTop(scrollRef);
      resetWizardMainScroll(scrollRef);
      pinStop.current = pinScrollTop(pendingScrollTop.current, scrollRef);
      flowInertClear.current?.();
      if (step !== activeStep) {
        flowInertClear.current = flashFlowInert(flowRef.current);
      }
      setActiveStep(step);
    },
    [scrollRef, activeStep],
  );

  useLayoutEffect(() => {
    if (pendingScrollTop.current === null) return;
    restoreMainScrollTop(pendingScrollTop.current, scrollRef);
    pendingScrollTop.current = null;
  }, [activeStep, scrollRef]);

  useEffect(() => {
    flowRef.current?.removeAttribute("inert");
    return () => flowInertClear.current?.();
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      pinStop.current?.();
      pinStop.current = null;
    }, 600);
    return () => clearTimeout(id);
  }, [activeStep]);

  useEffect(() => {
    return () => pinStop.current?.();
  }, []);

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
    manualDeployState: page.manualDeployState,
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

  const stepDef = steps.find((s) => s.id === activeStep);

  const rightHeader = stepDef && (
    <WorkerStepHeader
      step={stepDef}
      projectName={page.displayWorkerName}
      onRefresh={page.refreshLists}
    />
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
        sidebarTop={
          <WorkerSidebarProjectBar
            workersQ={page.workersQ}
            workerDir={page.workerDir}
            onSelectDir={page.setWorkerDir}
          />
        }
        rightHeader={rightHeader}
        scrollMain
      >
        {stepDef && (
          <WorkerStepContent
            step={activeStep as WorkerSetupStep}
            token={token}
            page={page}
            cfError={cfError}
            embedded
          />
        )}
      </WorkerSetupWorkspace>
    </div>
  );
}
