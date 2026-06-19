import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ScrollSafeButton } from "@/components/ui/ScrollSafeButton";
import { Select } from "@/components/ui/Select";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { useLocale } from "@/contexts/LocaleContext";
import {
  applySupabaseProject,
  disconnectSupabase,
  fetchSupabaseMigrationDirs,
  fetchSupabaseMigrationStatus,
  fetchSupabaseFunctionsDirs,
  fetchSupabaseFunctionsStatus,
  fetchSupabaseProjects,
  fetchSupabaseStatus,
  saveSupabaseTestCredentials,
  startSupabaseConnect,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { SourceBadge } from "./SourceBadge";
import { SupabaseSchemaSection } from "./SupabaseSchemaSection";
import { SupabaseFunctionsSection } from "./SupabaseFunctionsSection";
import type { SupabaseViewMode } from "@/components/supabase/SupabaseSetupStepSidebar";
import type { FieldMetaEntry } from "@/types";

function StepBadge({
  n,
  label,
  active,
  done,
}: {
  n: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]",
        done && "bg-emerald-500/15 text-emerald-300",
        active && !done && "bg-[var(--color-accent)]/20 text-[var(--color-text)]",
        !active && !done && "bg-[var(--color-bg)] text-[var(--color-muted)]",
      )}
    >
      <span className="font-mono">{done ? "✓" : n}</span>
      {label}
    </span>
  );
}

export function SupabaseConnectPanel({
  variant = "embedded",
  supabaseUrl = null,
  supabaseUrlMeta,
  hasAnonKey = false,
  hasTestCredentials = false,
  testEmail,
  onTestEmailChange,
  testPassword,
  onTestPasswordChange,
  accessToken,
  onAccessTokenChange,
  onApplied,
  activeStep,
}: {
  variant?: "embedded" | "page";
  activeStep?: SupabaseViewMode;
  supabaseUrl?: string | null;
  supabaseUrlMeta?: FieldMetaEntry;
  hasAnonKey?: boolean;
  hasTestCredentials?: boolean;
  testEmail: string;
  onTestEmailChange: (v: string) => void;
  testPassword: string;
  onTestPasswordChange: (v: string) => void;
  accessToken: string;
  onAccessTokenChange: (v: string) => void;
  onApplied?: () => void;
}) {
  const isPage = variant === "page";
  const pageStepMode = isPage && activeStep !== undefined;
  const showSchemaFeatures = true;
  const showStep = (step: "connect" | "project" | "database" | "functions") => {
    if (!showSchemaFeatures && (step === "database" || step === "functions")) return false;
    return !pageStepMode || activeStep === "all" || activeStep === step;
  };
  const { token } = useAdminToken();
  const { t, displayError } = useLocale();
  const queryClient = useQueryClient();
  const [selectedRef, setSelectedRef] = useState("");
  const [awaitingTestAccount, setAwaitingTestAccount] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const statusQ = useQuery({
    queryKey: ["supabase-status", token],
    queryFn: async () => {
      const r = await fetchSupabaseStatus(token);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token),
  });

  const projectsQ = useQuery({
    queryKey: ["supabase-projects", token],
    queryFn: async () => {
      const r = await fetchSupabaseProjects(token);
      if (!r.ok) throw new Error(r.error);
      return r.data.projects;
    },
    enabled: Boolean(token && statusQ.data?.connected),
  });

  const appliedProject = useMemo(() => {
    const projects = projectsQ.data ?? [];
    if (!supabaseUrl) return null;
    const ref = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (!ref) return null;
    const fromList = projects.find((p) => p.ref === ref);
    if (fromList) return { name: fromList.name, ref: fromList.ref };
    return { name: ref, ref };
  }, [supabaseUrl, projectsQ.data]);

  const migrationDirsQ = useQuery({
    queryKey: ["supabase-migration-dirs", token],
    queryFn: async () => {
      const r = await fetchSupabaseMigrationDirs(token);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(showSchemaFeatures && token),
  });

  const functionsDirsQ = useQuery({
    queryKey: ["supabase-functions-dirs", token],
    queryFn: async () => {
      const r = await fetchSupabaseFunctionsDirs(token);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(showSchemaFeatures && token),
  });

  const migrationsQ = useQuery({
    queryKey: ["supabase-migrations", token, appliedProject?.ref, migrationDirsQ.data?.current],
    queryFn: async () => {
      const r = await fetchSupabaseMigrationStatus(
        token,
        appliedProject!.ref,
        migrationDirsQ.data!.current,
      );
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(
      showSchemaFeatures && token && appliedProject?.ref && hasAnonKey && migrationDirsQ.data?.current,
    ),
    retry: false,
  });

  const functionsQ = useQuery({
    queryKey: ["supabase-functions", token, appliedProject?.ref, functionsDirsQ.data?.current],
    queryFn: async () => {
      const r = await fetchSupabaseFunctionsStatus(
        token,
        appliedProject!.ref,
        functionsDirsQ.data!.current,
      );
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(
      showSchemaFeatures && token && appliedProject?.ref && hasAnonKey && functionsDirsQ.data?.current,
    ),
    retry: false,
  });

  const connectM = useMutation({
    mutationFn: async () => {
      const r = await startSupabaseConnect(token);
      if (!r.ok) throw new Error(r.error);
      return r.data.url;
    },
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: (e: Error) => toast.error(displayError(e.message)),
  });

  const applyM = useMutation({
    mutationFn: async (ref: string) => {
      const r = await applySupabaseProject(token, ref);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: () => {
      if (!isPage) setAwaitingTestAccount(true);
      toast.success(t("supabase.toastStep2"));
      void queryClient.invalidateQueries({ queryKey: ["public-config"] });
      void queryClient.invalidateQueries({ queryKey: ["supabase-projects"] });
      void queryClient.invalidateQueries({ queryKey: ["worker-status"] });
      onApplied?.();
    },
    onError: (e: Error) => toast.error(displayError(e.message)),
  });

  const saveTestM = useMutation({
    mutationFn: async () => {
      const r = await saveSupabaseTestCredentials(token, testEmail, testPassword);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: () => {
      setAwaitingTestAccount(false);
      toast.success(t("supabase.toastStep3"));
      void queryClient.invalidateQueries({ queryKey: ["public-config"] });
      void queryClient.invalidateQueries({ queryKey: ["supabase-status"] });
      onApplied?.();
    },
    onError: (e: Error) => toast.error(displayError(e.message)),
  });

  const disconnectM = useMutation({
    mutationFn: async () => {
      const r = await disconnectSupabase(token);
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      setAwaitingTestAccount(false);
      toast.message(t("supabase.toastDisconnected"));
      void queryClient.invalidateQueries({ queryKey: ["supabase-status"] });
      void queryClient.invalidateQueries({ queryKey: ["supabase-projects"] });
    },
    onError: (e: Error) => toast.error(displayError(e.message)),
  });

  useEffect(() => {
    if (hasTestCredentials) setAwaitingTestAccount(false);
  }, [hasTestCredentials]);

  useEffect(() => {
    if (!awaitingTestAccount || hasTestCredentials) return;
    emailRef.current?.focus();
  }, [awaitingTestAccount, hasTestCredentials]);

  const status = statusQ.data;
  const projects = projectsQ.data ?? [];
  const resolvedTestEmail =
    testEmail.trim() ||
    status?.local_test?.email ||
    status?.account?.test_email ||
    "";
  const showTestAccountInfo = hasTestCredentials || Boolean(resolvedTestEmail);
  const stepConnect = Boolean(status?.connected);
  const stepApply = hasAnonKey && Boolean(supabaseUrl);
  const stepTest = hasTestCredentials;
  const migrationStatus = migrationsQ.data;
  const stepSchema =
    stepApply &&
    Boolean(migrationStatus) &&
    migrationStatus!.pending_count === 0 &&
    migrationStatus!.migration_files.length > 0;
  const functionsStatus = functionsQ.data;
  const stepFunctions =
    stepApply &&
    Boolean(functionsStatus) &&
    functionsStatus!.pending_count === 0 &&
    (functionsStatus!.function_summary?.local ?? 0) > 0;
  const showTestStep = stepApply && !stepTest && (awaitingTestAccount || hasAnonKey);
  const configComplete = stepApply && stepTest;
  const hasSessionAuth =
    Boolean(accessToken.trim()) ||
    hasTestCredentials ||
    (hasAnonKey && testEmail.trim() && testPassword);
  const needsAuth = stepApply && hasAnonKey && !hasSessionAuth;
  const showAuthSection = stepApply && hasAnonKey;

  if (!token) {
    return <p className="text-xs text-amber-200">{t("supabase.noAdminToken")}</p>;
  }

  if (!status?.oauth_configured) {
    return <p className="text-xs text-[var(--color-muted)]">{t("supabase.oauthNotConfigured")}</p>;
  }

  return (
    <div
      className={cn(
        "min-w-0 space-y-3",
        !isPage && "rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3",
        pageStepMode && "space-y-4",
      )}
    >
      {!pageStepMode && (
        <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-[var(--color-text)]">{t("supabase.wizardTitle")}</span>
        <span className="text-[10px] text-[var(--color-muted)]">
          {status.connected ? t("supabase.authConnected") : t("supabase.authDisconnected")} ·{" "}
          {t("supabase.localOAuth")}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <StepBadge
          n={1}
          label={t("supabase.step1Label")}
          active={!stepConnect && !stepApply}
          done={stepConnect}
        />
        <StepBadge n={2} label={t("supabase.step2Label")} active={!stepApply} done={stepApply} />
        {isPage ? (
          <>
            <StepBadge
              n={3}
              label={t("supabase.step4Label")}
              active={stepApply && !stepSchema}
              done={stepSchema}
            />
            <StepBadge
              n={4}
              label={t("supabase.stepFunctionsLabel")}
              active={stepApply && stepSchema && !stepFunctions}
              done={stepFunctions}
            />
          </>
        ) : (
          <>
            <StepBadge n={3} label={t("supabase.step3Label")} active={showTestStep} done={stepTest} />
          </>
        )}
      </div>
        </>
      )}

      {!pageStepMode && !isPage &&
      ((status?.connected && status.account) || showTestAccountInfo || appliedProject || supabaseUrl) ? (
        <div className="space-y-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-2.5 py-2 text-xs">
          <p className="text-[10px] text-[var(--color-muted)]">{t("supabase.accountInfo")}</p>
          <ul className="space-y-1 text-[var(--color-text)]">
            {status?.connected && status.account && (
              <li className="text-[var(--color-muted)]">
                {t("supabase.platformConnected", { count: status.account.projects_count })}
              </li>
            )}
            {supabaseUrl && (
              <li>
                <span className="text-[var(--color-muted)]">{t("supabase.projectUrl")} </span>
                <code className="mono block break-all text-[11px]">{supabaseUrl}</code>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  {supabaseUrlMeta && <SourceBadge meta={supabaseUrlMeta} />}
                  {hasAnonKey && <span className="text-emerald-300">{t("supabase.anonKeyConfigured")}</span>}
                </div>
              </li>
            )}
            {appliedProject && (
              <li>
                <span className="text-[var(--color-muted)]">{t("supabase.appliedProject")} </span>
                <span>
                  {appliedProject.name}{" "}
                  <code className="mono text-[11px]">({appliedProject.ref})</code>
                </span>
              </li>
            )}
            {showTestAccountInfo && (
              <>
                <li>
                  <span className="text-[var(--color-muted)]">{t("supabase.testEmail")} </span>
                  <code className="mono break-all text-emerald-300">
                    {resolvedTestEmail || "—"}
                  </code>
                </li>
                <li>
                  <span className="text-[var(--color-muted)]">{t("supabase.testPassword")} </span>
                  <span className={hasTestCredentials ? "text-emerald-300" : "text-amber-200"}>
                    {hasTestCredentials ? t("supabase.testPasswordSaved") : t("supabase.testPasswordNotSaved")}
                  </span>
                </li>
              </>
            )}
          </ul>
        </div>
      ) : null}

      {!pageStepMode && configComplete && !isPage && (
        <p className="text-xs text-emerald-300">{t("supabase.configComplete")}</p>
      )}

      {showStep("connect") && (
        <>
          <p className="text-[10px] text-[var(--color-muted)]">{t("supabase.oauthFetchHint")}</p>
          {!status.connected ? (
            <div className="space-y-2">
              {status.client_id_hint && (
                <p className="text-[10px] text-[var(--color-muted)]">
                  {t("supabase.clientIdHint", {
                    clientId: status.client_id_hint,
                    redirect: status.redirect_uri ?? "",
                  })}
                </p>
              )}
              <p className="text-[10px] text-[var(--color-muted)]">{t("supabase.oauthAppHint")}</p>
              <ScrollSafeButton
                size="sm"
                disabled={connectM.isPending || !status.local_only}
                busy={connectM.isPending}
                onAction={() => connectM.mutate()}
              >
                {connectM.isPending ? t("supabase.redirecting") : t("supabase.connectBtn")}
              </ScrollSafeButton>
            </div>
          ) : (
            <p className="text-xs text-emerald-300">
              {t("supabase.meta.connectDone", { count: status.account?.projects_count ?? 0 })}
            </p>
          )}
        </>
      )}

      {showStep("project") && status.connected && (
        <div className="space-y-3">
          {!stepApply || applyM.isPending ? (
            <div className="space-y-2">
              <p className="text-xs text-[var(--color-muted)]">{t("supabase.step2Title")}</p>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={selectedRef}
                  onChange={(e) => setSelectedRef(e.target.value)}
                  className="min-w-[160px] flex-1 text-xs"
                >
                  <option value="">{t("supabase.selectProject")}</option>
                  {projects.map((p) => (
                    <option key={p.ref} value={p.ref}>
                      {p.name} ({p.ref})
                    </option>
                  ))}
                </Select>
                <ScrollSafeButton
                  size="sm"
                  disabled={!selectedRef || applyM.isPending}
                  busy={applyM.isPending}
                  onAction={() => applyM.mutate(selectedRef)}
                >
                  {applyM.isPending ? t("supabase.writing") : t("supabase.applyConfig")}
                </ScrollSafeButton>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-xs text-[var(--color-text)]">
              <p className="text-[var(--color-muted)]">
                {t("supabase.step2Done")}
                {appliedProject ? `: ${appliedProject.name}` : ""}
              </p>
              {supabaseUrl && (
                <code className="mono block break-all text-[11px]">{supabaseUrl}</code>
              )}
              {hasAnonKey && (
                <p className="text-emerald-300">{t("supabase.anonKeyConfigured")}</p>
              )}
            </div>
          )}

          <ScrollSafeButton
            variant="ghost"
            size="sm"
            disabled={disconnectM.isPending}
            busy={disconnectM.isPending}
            onAction={() => disconnectM.mutate()}
          >
            {t("supabase.disconnect")}
          </ScrollSafeButton>
        </div>
      )}

      {showStep("database") && stepApply && appliedProject?.ref && (
        <SupabaseSchemaSection
          token={token}
          projectRef={appliedProject.ref}
          variant={variant}
          hideTitle={pageStepMode}
        />
      )}

      {showStep("database") && !stepApply && pageStepMode && (
        <p className="text-xs text-[var(--color-muted)]">{t("supabase.meta.databaseBlocked")}</p>
      )}

      {showStep("functions") && stepApply && appliedProject?.ref && (
        <SupabaseFunctionsSection
          token={token}
          projectRef={appliedProject.ref}
          hideTitle={pageStepMode}
        />
      )}

      {showStep("functions") && !stepApply && pageStepMode && (
        <p className="text-xs text-[var(--color-muted)]">{t("supabase.meta.functionsBlocked")}</p>
      )}

      {!isPage && showAuthSection && (
        <div className="space-y-2 border-t border-[var(--color-border)] pt-3">
          {!hasTestCredentials && (
            <div
              className={cn(
                "space-y-2 rounded-lg p-2.5",
                showTestStep && "border border-amber-500/40 bg-amber-500/5",
              )}
            >
              {showTestStep && (
                <p className="text-xs font-medium text-amber-100">{t("supabase.step3Title")}</p>
              )}
              <p className="text-[10px] text-[var(--color-muted)]">{t("supabase.step3Desc")}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-[var(--color-muted)]">{t("supabase.email")}</label>
                  <input
                    ref={emailRef}
                    type="email"
                    value={testEmail}
                    onChange={(e) => onTestEmailChange(e.target.value)}
                    placeholder={t("supabase.emailPlaceholder")}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-1.5 text-xs outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[var(--color-muted)]">{t("supabase.password")}</label>
                  <input
                    type="password"
                    value={testPassword}
                    onChange={(e) => onTestPasswordChange(e.target.value)}
                    placeholder={t("supabase.passwordPlaceholder")}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-1.5 text-xs outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
              </div>
              <ScrollSafeButton
                size="sm"
                disabled={!testEmail.trim() || !testPassword || saveTestM.isPending}
                busy={saveTestM.isPending}
                onAction={() => saveTestM.mutate()}
              >
                {saveTestM.isPending ? t("supabase.saving") : t("supabase.saveTestAccount")}
              </ScrollSafeButton>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs text-[var(--color-muted)]">{t("supabase.accessTokenLabel")}</label>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => onAccessTokenChange(e.target.value)}
              placeholder={
                hasTestCredentials
                  ? t("supabase.accessTokenPlaceholderSaved")
                  : t("supabase.accessTokenPlaceholder")
              }
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-1.5 text-xs outline-none focus:border-[var(--color-accent)]"
            />
            {needsAuth && (
              <p className="text-xs text-amber-200">{t("supabase.needsAuth")}</p>
            )}
          </div>
        </div>
      )}

      {!status.local_only && (
        <p className="text-xs text-amber-200">{t("supabase.nonLocalBind")}</p>
      )}
    </div>
  );
}
