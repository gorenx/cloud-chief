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
import type { FlowStepCardContent } from "@/lib/flow-card-content";
import { buildFlowCardStatus, truncateFlowLabel } from "@/lib/flow-card-content";

export type LocalizedSupabaseStep = {
  id: SupabaseSetupStep;
  num: number;
  label: string;
  summary: string;
  hint: string;
};

const STEP_LABEL_KEYS: Record<SupabaseSetupStep, MessageKey> = {
  connect: "supabase.step.connect.label",
  project: "supabase.step.project.label",
  database: "supabase.step.database.label",
  functions: "supabase.step.functions.label",
};

const STEP_HINT_KEYS: Record<SupabaseSetupStep, MessageKey> = {
  connect: "supabase.step.connect.hint",
  project: "supabase.step.project.hint",
  database: "supabase.step.database.hint",
  functions: "supabase.step.functions.hint",
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
    hint: t(STEP_HINT_KEYS[step.id]),
  }));
}

export function formatSupabaseStepCardContent(
  t: TranslateFn,
  step: SupabaseSetupStep,
  status: SupabaseSetupStatus,
): FlowStepCardContent {
  if (step === "connect") {
    if (!status.oauthConfigured) {
      return { status: t("supabase.meta.oauthNotConfigured"), tone: "warn" };
    }
    if (status.connectDone) {
      return {
        status: t("supabase.meta.connectDone", { count: status.projectsCount }),
        tone: "done",
      };
    }
    return { status: t("supabase.meta.connectPending"), tone: "pending" };
  }
  if (step === "project") {
    if (status.projectDone) {
      if (!status.projectName) {
        return { status: t("supabase.meta.projectDoneUrl"), tone: "done" };
      }
      const full = t("supabase.meta.projectDone", { name: status.projectName });
      const display = t("supabase.meta.projectDone", { name: truncateFlowLabel(status.projectName) });
      return buildFlowCardStatus(display, full, "done");
    }
    if (!status.connectDone) {
      return { status: t("supabase.meta.projectBlocked"), tone: "muted" };
    }
    return { status: t("supabase.meta.projectPending"), tone: "pending" };
  }
  if (step === "database") {
    if (status.databaseDone) return { status: t("supabase.meta.databaseDone"), tone: "done" };
    if (!status.projectDone) return { status: t("supabase.meta.databaseBlocked"), tone: "muted" };
    if (status.needsDbScope) return { status: t("supabase.meta.databaseNeedsScope"), tone: "warn" };
    if (status.migrationFileCount === 0) {
      return { status: t("supabase.meta.databaseNoFiles"), tone: "muted" };
    }
    if (status.pendingMigrations > 0) {
      return {
        status: t("supabase.meta.databasePending", { count: status.pendingMigrations }),
        tone: "warn",
      };
    }
    return { status: t("supabase.meta.databaseChecking"), tone: "muted" };
  }
  if (status.functionsDone) return { status: t("supabase.meta.functionsDone"), tone: "done" };
  if (!status.projectDone) return { status: t("supabase.meta.functionsBlocked"), tone: "muted" };
  if (status.needsFunctionsScope) {
    return { status: t("supabase.meta.functionsNeedsScope"), tone: "warn" };
  }
  if (status.localFunctionCount === 0) {
    return { status: t("supabase.meta.functionsNoLocal"), tone: "muted" };
  }
  if (status.pendingFunctions > 0) {
    return {
      status: t("supabase.meta.functionsPending", { count: status.pendingFunctions }),
      tone: "warn",
    };
  }
  return { status: t("supabase.meta.functionsChecking"), tone: "muted" };
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
