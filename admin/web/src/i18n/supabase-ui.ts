import {
  SUPABASE_SETUP_STEPS,
  nextSupabaseSetupStep,
  supabaseSetupWarningKeys,
  supabaseStepDone,
  type SupabaseSetupStatus,
  type SupabaseSetupStep,
  type SupabaseSetupWarningKey,
} from "@/lib/supabase-setup-flow";
import type { MessageKey, TranslateFn } from "@/i18n";

export type LocalizedSupabaseStep = {
  id: SupabaseSetupStep;
  num: number;
  label: string;
  summary: string;
};

const STEP_LABEL_KEYS: Record<SupabaseSetupStep, MessageKey> = {
  connect: "supabase.step.connect.label",
  project: "supabase.step.project.label",
  database: "supabase.step.database.label",
  functions: "supabase.step.functions.label",
};

const STEP_SUMMARY_KEYS: Record<SupabaseSetupStep, MessageKey> = {
  connect: "supabase.step.connect.summary",
  project: "supabase.step.project.summary",
  database: "supabase.step.database.summary",
  functions: "supabase.step.functions.summary",
};

const ACTION_KEYS: Record<SupabaseSetupStep, MessageKey> = {
  connect: "supabase.action.connect",
  project: "supabase.action.project",
  database: "supabase.action.database",
  functions: "supabase.action.functions",
};

const WARNING_KEYS: Record<SupabaseSetupWarningKey, MessageKey> = {
  needsDbScope: "supabase.warning.needsDbScope",
  needsFunctionsScope: "supabase.warning.needsFunctionsScope",
  oauthNotConfigured: "supabase.warning.oauthNotConfigured",
  nonLocalBind: "supabase.warning.nonLocalBind",
};

export function getLocalizedSupabaseSteps(t: TranslateFn): LocalizedSupabaseStep[] {
  return SUPABASE_SETUP_STEPS.map((step) => ({
    id: step.id,
    num: step.num,
    label: t(STEP_LABEL_KEYS[step.id]),
    summary: t(STEP_SUMMARY_KEYS[step.id]),
  }));
}

export function formatSupabaseStepMeta(
  t: TranslateFn,
  step: SupabaseSetupStep,
  status: SupabaseSetupStatus,
): string {
  if (step === "connect") {
    if (!status.oauthConfigured) return t("supabase.meta.oauthNotConfigured");
    return status.connectDone
      ? t("supabase.meta.connectDone", { count: status.projectsCount })
      : t("supabase.meta.connectPending");
  }
  if (step === "project") {
    if (status.projectDone) {
      return status.projectName
        ? t("supabase.meta.projectDone", { name: status.projectName })
        : t("supabase.meta.projectDoneUrl");
    }
    return status.connectDone ? t("supabase.meta.projectPending") : t("supabase.meta.projectBlocked");
  }
  if (step === "database") {
    if (status.databaseDone) return t("supabase.meta.databaseDone");
    if (!status.projectDone) return t("supabase.meta.databaseBlocked");
    if (status.needsDbScope) return t("supabase.meta.databaseNeedsScope");
    if (status.migrationFileCount === 0) return t("supabase.meta.databaseNoFiles");
    if (status.pendingMigrations > 0) {
      return t("supabase.meta.databasePending", { count: status.pendingMigrations });
    }
    return t("supabase.meta.databaseChecking");
  }
  if (status.functionsDone) return t("supabase.meta.functionsDone");
  if (!status.projectDone) return t("supabase.meta.functionsBlocked");
  if (status.needsFunctionsScope) return t("supabase.meta.functionsNeedsScope");
  if (status.localFunctionCount === 0) return t("supabase.meta.functionsNoLocal");
  if (status.pendingFunctions > 0) {
    return t("supabase.meta.functionsPending", { count: status.pendingFunctions });
  }
  return t("supabase.meta.functionsChecking");
}

export function formatSupabaseSetupWarnings(
  t: TranslateFn,
  status: SupabaseSetupStatus,
): string[] {
  return supabaseSetupWarningKeys(status).map((key) => t(WARNING_KEYS[key]));
}

export function formatNextSupabaseSetupAction(
  t: TranslateFn,
  status: SupabaseSetupStatus,
): { text: string; step: SupabaseSetupStep } | null {
  const step = nextSupabaseSetupStep(status);
  if (!step) return null;
  if (supabaseStepDone(step, status)) return null;
  return { text: t(ACTION_KEYS[step]), step };
}
