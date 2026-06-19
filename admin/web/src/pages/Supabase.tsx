import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { NoTokenPrompt } from "@/components/NoTokenPrompt";
import { SupabaseConnectPanel } from "@/components/SupabaseConnectPanel";
import { SupabaseSetupFlow } from "@/components/supabase/SupabaseSetupFlow";
import { SupabaseSetupWorkspace } from "@/components/supabase/SupabaseSetupWorkspace";
import { SupabaseStepPanelHeader } from "@/components/supabase/SupabaseStepPanel";
import type { SupabaseViewMode } from "@/components/supabase/SupabaseSetupStepSidebar";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { useLocale } from "@/contexts/LocaleContext";
import { useScrollContainer } from "@/contexts/ScrollContainerContext";
import {
  pinScrollTop,
  readMainScrollTop,
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [testEmail, setTestEmail] = useState("");
  const [testPassword, setTestPassword] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [activeStep, setActiveStep] = useState<SupabaseViewMode>("connect");
  const [activeInit, setActiveInit] = useState(false);
  const flowRef = useRef<HTMLDivElement>(null);
  const scrollRef = useScrollContainer();
  const pendingScrollTop = useRef<number | null>(null);
  const pinStop = useRef<(() => void) | null>(null);

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

  const selectStepFromWorkspace = useCallback(
    (step: SupabaseViewMode) => {
      pinStop.current?.();
      const top = readMainScrollTop(scrollRef);
      pendingScrollTop.current = top;
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setFlowInert(flowRef.current, true);
      pinStop.current = pinScrollTop(top, scrollRef);
      setActiveStep(step);
    },
    [scrollRef],
  );

  const selectStepFromFlow = useCallback((step: SupabaseSetupStep) => {
    setActiveStep(step);
  }, []);

  useLayoutEffect(() => {
    if (pendingScrollTop.current === null) return;
    restoreMainScrollTop(pendingScrollTop.current, scrollRef);
  }, [activeStep, scrollRef]);

  useEffect(() => {
    if (pendingScrollTop.current === null) return;
    const id = window.setTimeout(() => {
      pinStop.current?.();
      pinStop.current = null;
      pendingScrollTop.current = null;
      setFlowInert(flowRef.current, false);
    }, 600);
    return () => clearTimeout(id);
  }, [activeStep, scrollRef]);

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

  const panelProps = {
    variant: "page" as const,
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

  const rightHeader =
    activeStep === "all" ? (
      <div>
        <h3 className="text-sm font-semibold leading-tight">{t("supabase.page.allSteps")}</h3>
        <p className="mt-1 text-xs text-[var(--color-muted)]">{t("supabase.page.allStepsDesc")}</p>
      </div>
    ) : (
      stepDef && <SupabaseStepPanelHeader step={stepDef} />
    );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t("supabase.page.title")}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{t("supabase.page.desc")}</p>
      </div>

      <div ref={flowRef}>
        <SupabaseSetupFlow flowStatus={flowStatus} onGoToStep={selectStepFromFlow} />
      </div>

      <SupabaseSetupWorkspace
        status={flowStatus}
        activeStep={activeStep}
        onSelect={selectStepFromWorkspace}
        onShowAll={() => selectStepFromWorkspace("all")}
        rightHeader={rightHeader}
      >
        {activeStep === "all" ? (
          <div className="space-y-8">
            {steps.map((def) => (
              <section key={def.id}>
                <div className="mb-4">
                  <SupabaseStepPanelHeader step={def} />
                </div>
                <SupabaseConnectPanel {...panelProps} activeStep={def.id} />
              </section>
            ))}
          </div>
        ) : (
          stepDef && (
            <SupabaseConnectPanel {...panelProps} activeStep={activeStep as SupabaseSetupStep} />
          )
        )}
      </SupabaseSetupWorkspace>
    </div>
  );
}
