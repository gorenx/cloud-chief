export type SupabaseSetupStep = "connect" | "project" | "database" | "functions";

export interface SupabaseSetupStepDef {
  id: SupabaseSetupStep;
  num: number;
  label: string;
  summary: string;
}

export const SUPABASE_SETUP_STEPS: SupabaseSetupStepDef[] = [
  {
    id: "connect",
    num: 1,
    label: "授权",
    summary: "通过 Organization OAuth 连接 Supabase 平台",
  },
  {
    id: "project",
    num: 2,
    label: "应用项目",
    summary: "选择项目并写入 SUPABASE_URL 与 anon key",
  },
  {
    id: "database",
    num: 3,
    label: "数据库",
    summary: "按表对比并应用本地 SQL 迁移与 RLS",
  },
  {
    id: "functions",
    num: 4,
    label: "Edge Functions",
    summary: "对比并部署本地 Edge Functions",
  },
];

export type SupabaseSetupWarningKey =
  | "needsDbScope"
  | "needsFunctionsScope"
  | "oauthNotConfigured"
  | "nonLocalBind";

export interface SupabaseSetupStatus {
  connectDone: boolean;
  projectDone: boolean;
  databaseDone: boolean;
  functionsDone: boolean;
  oauthConfigured: boolean;
  localOnly: boolean;
  connected: boolean;
  projectRef: string | null;
  projectName: string | null;
  supabaseUrl: string | null;
  pendingMigrations: number;
  migrationFileCount: number;
  pendingFunctions: number;
  localFunctionCount: number;
  needsDbScope: boolean;
  needsFunctionsScope: boolean;
  projectsCount: number;
}

export interface DeriveSupabaseSetupInput {
  oauthConfigured: boolean;
  localOnly: boolean;
  connected: boolean;
  supabaseUrl: string | null;
  hasAnonKey: boolean;
  projectRef: string | null;
  projectName: string | null;
  projectsCount: number;
  pendingMigrations: number;
  migrationFileCount: number;
  pendingFunctions: number;
  localFunctionCount: number;
  needsDbScope: boolean;
  needsFunctionsScope: boolean;
}

export function deriveSupabaseSetupStatus(input: DeriveSupabaseSetupInput): SupabaseSetupStatus {
  const connectDone = input.connected;
  const projectDone = input.hasAnonKey && Boolean(input.supabaseUrl);
  const databaseDone =
    projectDone &&
    input.migrationFileCount > 0 &&
    input.pendingMigrations === 0 &&
    !input.needsDbScope;
  const functionsDone =
    projectDone &&
    input.localFunctionCount > 0 &&
    input.pendingFunctions === 0 &&
    !input.needsFunctionsScope;

  return {
    connectDone,
    projectDone,
    databaseDone,
    functionsDone,
    oauthConfigured: input.oauthConfigured,
    localOnly: input.localOnly,
    connected: input.connected,
    projectRef: input.projectRef,
    projectName: input.projectName,
    supabaseUrl: input.supabaseUrl,
    pendingMigrations: input.pendingMigrations,
    migrationFileCount: input.migrationFileCount,
    pendingFunctions: input.pendingFunctions,
    localFunctionCount: input.localFunctionCount,
    needsDbScope: input.needsDbScope,
    needsFunctionsScope: input.needsFunctionsScope,
    projectsCount: input.projectsCount,
  };
}

export function supabaseStepDone(step: SupabaseSetupStep, status: SupabaseSetupStatus): boolean {
  if (step === "connect") return status.connectDone;
  if (step === "project") return status.projectDone;
  if (step === "database") return status.databaseDone;
  return status.functionsDone;
}

export function supabaseCoreDone(status: SupabaseSetupStatus): boolean {
  return (
    status.connectDone &&
    status.projectDone &&
    status.databaseDone &&
    status.functionsDone
  );
}

export function supabaseSetupProgress(status: SupabaseSetupStatus): {
  coreDone: number;
  coreTotal: number;
  totalDone: number;
  totalSteps: number;
} {
  const done = [
    status.connectDone,
    status.projectDone,
    status.databaseDone,
    status.functionsDone,
  ].filter(Boolean).length;
  return {
    coreDone: done,
    coreTotal: SUPABASE_SETUP_STEPS.length,
    totalDone: done,
    totalSteps: SUPABASE_SETUP_STEPS.length,
  };
}

export function resolveSupabaseSetupCurrent(status: SupabaseSetupStatus): SupabaseSetupStep {
  if (!status.connectDone) return "connect";
  if (!status.projectDone) return "project";
  if (!status.databaseDone) return "database";
  if (!status.functionsDone) return "functions";
  return "functions";
}

export function nextSupabaseSetupStep(status: SupabaseSetupStatus): SupabaseSetupStep | null {
  if (!status.connectDone) return "connect";
  if (!status.projectDone) return "project";
  if (!status.databaseDone) return "database";
  if (!status.functionsDone) return "functions";
  return null;
}

export function supabaseSetupWarningKeys(status: SupabaseSetupStatus): SupabaseSetupWarningKey[] {
  const keys: SupabaseSetupWarningKey[] = [];
  if (!status.oauthConfigured) keys.push("oauthNotConfigured");
  if (status.connectDone && !status.localOnly) keys.push("nonLocalBind");
  if (status.needsDbScope) keys.push("needsDbScope");
  if (status.needsFunctionsScope) keys.push("needsFunctionsScope");
  return keys;
}
