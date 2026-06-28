import { useEffect, useMemo, useState } from "react";
import {
  SetupStepCallGuide,
  type SetupCallGuideOverrides,
} from "@/components/SetupStepCallGuide";
import {
  FlowActionBar,
  FlowWarnings,
  GATEWAY_SETUP_BODY_ID,
  focusGatewaySetupBody,
} from "@/components/flow/FlowShellBody";
import { FlowShellHeader } from "@/components/flow/FlowShellHeader";
import { FlowStepCardNav } from "@/components/flow/FlowStepCardNav";
import { SetupFlowUrlPreview } from "@/components/setup-flow/SetupFlowUrlPreview";
import { FlowPanel } from "@/components/ui/SetupStepBadge";
import { useSetupFlowData } from "@/hooks/useSetupFlowData";
import { useT } from "@/contexts/LocaleContext";
import {
  formatNextSetupAction,
  formatSetupWarnings,
  formatSetupStepCardContent,
  getLocalizedSetupSteps,
} from "@/i18n/setup-flow-ui";
import {
  defaultSelectedStep,
  resolveSetupCurrent,
  setupSetupProgress,
  stepDone,
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
  const t = useT();
  const [open, setOpen] = useState(defaultOpen ?? !collapsible);
  const { stateQ, ctxQ, status } = useSetupFlowData();

  const current = resolveSetupCurrent(pageStep, status);
  const [selectedStep, setSelectedStep] = useState<SetupStep>(() =>
    defaultSelectedStep(pageStep, status),
  );

  useEffect(() => {
    if (pageStep) setSelectedStep(pageStep);
  }, [pageStep]);

  const steps = useMemo(() => getLocalizedSetupSteps(t), [t]);
  const coreDone = status.gatewayDone && status.providerDone;
  const progress = setupSetupProgress(status);
  const progressPct = Math.round((progress.done / progress.total) * 100);
  const action = formatNextSetupAction(t, status, current);
  const warnings = formatSetupWarnings(t, status, pageStep);
  const d = stateQ.data?.defaults;
  const usePageGuide = pageStep === "byok" && selectedStep === "byok";

  const guide = {
    gatewayId: (usePageGuide && callGuide?.gatewayId) || d?.gateway || "",
    slug: (usePageGuide && callGuide?.providerSlug) || d?.provider_slug || "",
    model: (usePageGuide && callGuide?.model) || d?.model || "qwen3-max",
    byok:
      selectedStep === "byok"
        ? (callGuide?.byokConfigured ?? status.byokDone)
        : status.byokDone,
    auth:
      (usePageGuide && callGuide?.gatewayAuthenticated) ??
      ctxQ.data?.gateway?.authentication,
  };

  const focusStep = (step: SetupStep) => {
    if (collapsible && !open) setOpen(true);
    setSelectedStep(step);
    focusGatewaySetupBody();
  };

  const handlePillClick = (step: SetupStep) => {
    focusStep(step);
  };

  const coreDoneBadge = coreDone
    ? t("setupFlow.coreDone") + (status.byokDone ? t("setupFlow.coreDoneByok") : "")
    : undefined;

  const showSecondaryByok = coreDone && !status.byokDone && current !== "byok";

  return (
    <FlowPanel>
      <FlowShellHeader
        title={t("setupFlow.title")}
        progressText={t("setupFlow.progress", { done: progress.done, total: progress.total })}
        subtitle={t("setupFlow.subtitle")}
        progressPct={progressPct}
        open={collapsible ? open : true}
        onToggle={() => setOpen((v) => !v)}
        collapsible={collapsible}
        steps={steps}
        stepDone={(step) => stepDone(step, status)}
        activeStep={selectedStep}
        onStepPillClick={handlePillClick}
        coreDoneBadge={coreDoneBadge}
      />

      {(!collapsible || open) && (
        <div id={GATEWAY_SETUP_BODY_ID} className="space-y-4 p-4 pt-3">
          <FlowStepCardNav
            steps={steps}
            status={status}
            selectedStep={selectedStep}
            onSelect={setSelectedStep}
            stepDone={(step, s) => stepDone(step, s)}
            formatStepCardContent={formatSetupStepCardContent}
            optionalLabel={t("common.optional")}
            pageStep={pageStep}
            currentPageLabel={t("setupFlow.thisPage")}
          />

          <SetupFlowUrlPreview accountId={stateQ.data?.account_id ?? ""} status={status} />

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

          {action && (
            <FlowActionBar
              text={action.text}
              goToLabel={t("btn.common.goTo")}
              focusLabel={t("btn.common.focusOnPage")}
              href={action.to}
              onInPageClick={() => focusStep(action.step)}
              secondary={
                showSecondaryByok
                  ? {
                      text: t("setupFlow.optionalByok"),
                      href: "/keys",
                      onInPageClick: () => focusStep("byok"),
                    }
                  : undefined
              }
            />
          )}

          <FlowWarnings warnings={warnings} />
        </div>
      )}
    </FlowPanel>
  );
}
