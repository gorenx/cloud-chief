import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { NoTokenPrompt } from "@/components/NoTokenPrompt";
import { PageHeader } from "@/components/ui/PageHeader";
import { SupabaseSetupFlow } from "@/components/supabase/SupabaseSetupFlow";
import { SupabaseSetupWorkspace } from "@/components/supabase/SupabaseSetupWorkspace";
import { SupabaseStepPanelHeader } from "@/components/supabase/SupabaseStepPanel";
import { SupabaseStepContent, type SupabasePanelProps } from "@/components/supabase/SupabaseStepContent";
import type { SupabaseViewMode } from "@/components/supabase/SupabaseSetupStepSidebar";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { useLocale } from "@/contexts/LocaleContext";
import { useScrollContainer } from "@/contexts/ScrollContainerContext";
import {
  pinScrollTop,
  readMainScrollTop,
  resetWizardMainScroll,
  restoreMainScrollTop,
  setFlowInert,
} from "@/lib/prevent-nav-scroll";
import { useSupabaseSetupFlowStatus } from "@/hooks/useSupabaseSetupFlowStatus";
import { getLocalizedSupabaseSteps } from "@/i18n/supabase-ui";
import { fetchPublicConfig } from "@/lib/api";
import { pickFields } from "@/lib/field-meta";
import { resolveSupabaseSetupCurrent, type SupabaseSetupStep } from "@/lib/supabase-setup-flow";

export function SupabasePage() {
  const { token } = useAdminToken();
  const { t } = useLocale();
  const scrollRef = useScrollContainer();
  const flowRef = useRef<HTMLDivElement>(null);
  const pinStop = useRef<(() => void) | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [testEmail, setTestEmail] = useState("");
  const [testPassword, setTestPassword] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [activeStep, setActiveStep] = useState<SupabaseViewMode>("connect");
  const [activeInit, setActiveInit] = useState(false);
  const pendingScrollTop = useRef<number | null>(null);

  const configQ = useQuery({
    queryKey: ["public-config"],
    queryFn: async () => {
      const r = await fetchPublicConfig();
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
  });

  const worker = configQ.data?.worker ?? null;
  const supabaseUrlMeta = pickFields(configQ.data?._meta)["worker.supabase_url"];

  const { flowStatus } = useSupabaseSetupFlowStatus({
    token: token ?? "",
    supabaseUrl: worker?.supabase_url ?? null,
    hasAnonKey: worker?.has_anon_key ?? false,
  });

  const selectStep = useCallback(
    (step: SupabaseViewMode) => {
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

  const steps = useMemo(() => getLocalizedSupabaseSteps(t), [t]);

  useEffect(() => {
    const supabase = searchParams.get("supabase");
    if (!supabase) return;
    if (supabase === "connected") {
      toast.success(t("playground.toastSupabaseStep1"));
      void configQ.refetch();
    } else if (supabase === "error") {
      const reason = searchParams.get("reason") ?? t("common.unknownError");
      toast.error(t("playground.toastSupabaseError", { reason }));
    }
    searchParams.delete("supabase");
    searchParams.delete("reason");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams, configQ, t]);

  useEffect(() => {
    if (activeInit || !configQ.data) return;
    setActiveStep(resolveSupabaseSetupCurrent(flowStatus));
    setActiveInit(true);
  }, [activeInit, configQ.data, flowStatus]);

  if (!token) {
    return <NoTokenPrompt />;
  }

  const panelProps: SupabasePanelProps = {
    variant: "page",
    supabaseUrl: worker?.supabase_url,
    supabaseUrlMeta,
    hasAnonKey: worker?.has_anon_key ?? false,
    hasTestCredentials: worker?.has_test_credentials ?? false,
    testEmail,
    onTestEmailChange: setTestEmail,
    testPassword,
    onTestPasswordChange: setTestPassword,
    accessToken,
    onAccessTokenChange: setAccessToken,
    onApplied: () => void configQ.refetch(),
  };

  const stepDef = activeStep !== "all" ? steps.find((s) => s.id === activeStep) : null;
  const projectRef = flowStatus.projectRef ?? null;

  const rightHeader =
    activeStep === "all" ? (
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h3 className="font-display text-sm font-semibold leading-tight">
          {t("supabase.page.allSteps")}
        </h3>
        <p className="max-w-[min(24rem,100%)] shrink-0 text-right text-xs text-[var(--color-muted)] sm:max-w-[min(24rem,45%)]">
          {t("supabase.page.allStepsDesc")}
        </p>
      </div>
    ) : (
      stepDef && (
        <SupabaseStepPanelHeader
          step={stepDef}
          projectRef={activeStep === "project" || activeStep === "connect" ? projectRef : undefined}
        />
      )
    );

  return (
    <div className="space-y-6">
      <PageHeader title={t("supabase.page.title")} description={t("supabase.page.desc")} />

      <SupabaseSetupFlow
        ref={flowRef}
        flowStatus={flowStatus}
        activeStep={activeStep}
        onGoToStep={selectStep}
      />

      <SupabaseSetupWorkspace
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
                  <SupabaseStepPanelHeader
                    step={def}
                    projectRef={
                      def.id === "project" || def.id === "connect" ? projectRef : undefined
                    }
                  />
                </div>
                <SupabaseStepContent step={def.id} panelProps={panelProps} />
              </section>
            ))}
          </div>
        ) : (
          stepDef && (
            <SupabaseStepContent step={activeStep as SupabaseSetupStep} panelProps={panelProps} />
          )
        )}
      </SupabaseSetupWorkspace>
    </div>
  );
}
