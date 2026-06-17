import { useEffect, useState } from "react";
import {
  SetupStepCallGuide,
  type SetupCallGuideOverrides,
} from "@/components/SetupStepCallGuide";
import { SetupFlowActions } from "@/components/setup-flow/SetupFlowActions";
import { SetupFlowHeader } from "@/components/setup-flow/SetupFlowHeader";
import { SetupFlowStepNav } from "@/components/setup-flow/SetupFlowStepNav";
import { SetupFlowUrlPreview } from "@/components/setup-flow/SetupFlowUrlPreview";
import { useSetupFlowData } from "@/hooks/useSetupFlowData";
import {
  SETUP_STEPS,
  defaultSelectedStep,
  nextSetupAction,
  resolveSetupCurrent,
  type SetupStep,
} from "@/lib/setup-flow";

export type { SetupCallGuideOverrides, SetupStep };

export function GatewaySetupFlow({
  current: pageStep,
  callGuide,
  collapsible,
  defaultOpen,
}: {
  current?: SetupStep;
  callGuide?: SetupCallGuideOverrides;
  collapsible?: boolean;
  /** collapsible 时默认是否展开；未指定时 collapsible 页默认折叠 */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? !collapsible);
  const { stateQ, ctxQ, status } = useSetupFlowData();

  const current = resolveSetupCurrent(pageStep, status);
  const [selectedStep, setSelectedStep] = useState<SetupStep>(() =>
    defaultSelectedStep(pageStep, status),
  );

  useEffect(() => {
    if (pageStep) setSelectedStep(pageStep);
  }, [pageStep]);

  const coreDone = status.gatewayDone && status.providerDone;
  const action = nextSetupAction(status, current);
  const currentIdx = SETUP_STEPS.findIndex((s) => s.id === current);
  const d = stateQ.data?.defaults;
  const usePageGuide = pageStep === "byok" && selectedStep === "byok";

  const guide = {
    gatewayId:
      (usePageGuide && callGuide?.gatewayId) || d?.gateway || "",
    slug:
      (usePageGuide && callGuide?.providerSlug) || d?.provider_slug || "",
    model:
      (usePageGuide && callGuide?.model) || d?.model || "qwen3-max",
    byok:
      selectedStep === "byok"
        ? (callGuide?.byokConfigured ?? status.byokDone)
        : status.byokDone,
    auth:
      (usePageGuide && callGuide?.gatewayAuthenticated) ??
      ctxQ.data?.gateway?.authentication,
  };

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]">
      <SetupFlowHeader
        collapsible={collapsible}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        currentStep={selectedStep}
        status={status}
      />

      {(!collapsible || open) && (
        <div className="space-y-3 p-4 pt-3">
          <SetupFlowStepNav
            status={status}
            pageStep={pageStep}
            selectedStep={selectedStep}
            onSelect={setSelectedStep}
          />
          <SetupFlowUrlPreview
            accountId={stateQ.data?.account_id ?? ""}
            status={status}
          />

          {d && (
            <SetupStepCallGuide
              step={selectedStep}
              accountId={stateQ.data?.account_id ?? ""}
              gatewayId={guide.gatewayId}
              providerSlug={guide.slug}
              path={d.path}
              model={guide.model}
              byokConfigured={guide.byok}
              gatewayAuthenticated={guide.auth}
            />
          )}

          <SetupFlowActions
            action={action}
            current={current}
            currentIdx={currentIdx}
            status={status}
            coreDone={coreDone}
            pageStep={pageStep}
          />
        </div>
      )}
    </div>
  );
}
