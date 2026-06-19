import type {
  AdminState,
  GatewayContext,
  PublicConfig,
  WorkerList,
  CfDeployedList,
  WorkerStatus,
  WorkerBuildsStatus,
} from "@/types";
import type { ApiI18nError } from "@/i18n/api-error";

export function errText(j: unknown): string {
  if (!j) return "common.unknownError" satisfies ApiI18nError;
  if (typeof j === "object" && j !== null) {
    const o = j as Record<string, unknown>;
    if (typeof o.error === "string") return o.error;
    if (o.error) return JSON.stringify(o.error);
    if (Array.isArray(o.errors)) {
      return o.errors
        .map((e) =>
          typeof e === "object" && e && "message" in e
            ? String((e as { message: string }).message)
            : JSON.stringify(e),
        )
        .join("; ");
    }
  }
  return JSON.stringify(j);
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

function authHeaders(token: string, extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function adminFetch<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const res = await fetch(path, {
    method,
    headers: authHeaders(token, body ? { "Content-Type": "application/json" } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await parseJson<T & { success?: boolean; error?: string }>(res);
  const failed = !res.ok || (j && typeof j === "object" && "success" in j && j.success === false);
  if (failed) {
    return { ok: false, status: res.status, error: errText(j) };
  }
  return { ok: true, data: j as T };
}

export async function fetchState(token: string) {
  return adminFetch<AdminState>(token, "GET", "/admin/state");
}

export async function fetchGatewayContext(token: string, id: string) {
  return adminFetch<GatewayContext>(token, "GET", `/admin/gateways/${encodeURIComponent(id)}/context`);
}

export async function fetchPublicConfig() {
  const res = await fetch("/config");
  const j = await parseJson<PublicConfig>(res);
  if (!res.ok || !j) return { ok: false as const, status: res.status, error: "common.configReadError" };
  return { ok: true as const, data: j };
}

export async function fetchKeys(token: string, gateway: string) {
  return adminFetch<{ result?: unknown[] }>(
    token,
    "GET",
    `/admin/keys?gateway=${encodeURIComponent(gateway)}`,
  );
}

export async function fetchWorkerList(token: string) {
  return adminFetch<WorkerList>(token, "GET", "/admin/worker/workers");
}

export async function fetchWorkerStatus(token: string, dir?: string) {
  const q = dir ? `?dir=${encodeURIComponent(dir)}` : "";
  return adminFetch<WorkerStatus>(token, "GET", `/admin/worker/status${q}`);
}

export async function fetchWorkerSecrets(token: string, dir?: string) {
  const q = dir ? `?dir=${encodeURIComponent(dir)}` : "";
  return adminFetch<{ ok: boolean; names: string[] }>(token, "GET", `/admin/worker/secrets${q}`);
}

export async function fetchCfDeployedWorkers(token: string) {
  return adminFetch<CfDeployedList>(token, "GET", "/admin/worker/cf-deployed");
}

export async function fetchWorkerBuildsStatus(token: string, dir?: string) {
  const q = dir ? `?dir=${encodeURIComponent(dir)}` : "";
  return adminFetch<WorkerBuildsStatus>(token, "GET", `/admin/worker/builds/status${q}`);
}

export async function syncWorkerBuildsConfig(token: string, dir?: string) {
  const q = dir ? `?dir=${encodeURIComponent(dir)}` : "";
  return adminFetch<{ ok: true; updated: string[]; cf_script_name: string }>(
    token,
    "POST",
    `/admin/worker/builds/sync${q}`,
  );
}

export async function triggerWorkerBuild(token: string, dir?: string, branch = "main") {
  const q = dir ? `?dir=${encodeURIComponent(dir)}` : "";
  return adminFetch<{ ok: true; build_uuid: string; trigger_name: string }>(
    token,
    "POST",
    `/admin/worker/builds/trigger${q}`,
    { branch },
  );
}

export async function saveWorkerBuilderToken(adminToken: string, builderToken: string) {
  return adminFetch<{ ok: true; token_configured: boolean }>(
    adminToken,
    "PUT",
    "/admin/worker/builds/token",
    { token: builderToken },
  );
}

export interface SupabaseOAuthStatus {
  oauth_configured: boolean;
  connected: boolean;
  account: {
    primary_email: string | null;
    username: string | null;
    projects_count: number;
    test_email: string | null;
  } | null;
  local_test: {
    email: string | null;
    configured: boolean;
  };
  expires_at: number | null;
  redirect_uri: string | null;
  client_id_hint: string | null;
  oauth_apps_url: string;
  local_only: boolean;
}

export interface SupabaseProjectRow {
  id: string;
  ref: string;
  name: string;
}

async function adminFetchWithCredentials<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: authHeaders(token, body ? { "Content-Type": "application/json" } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await parseJson<T & { error?: string }>(res);
  if (!res.ok) {
    return { ok: false, status: res.status, error: errText(j) };
  }
  return { ok: true, data: j as T };
}

export async function fetchSupabaseStatus(token: string) {
  return adminFetch<SupabaseOAuthStatus>(token, "GET", "/admin/supabase/status");
}

export async function startSupabaseConnect(token: string) {
  return adminFetchWithCredentials<{ url: string }>(token, "POST", "/admin/supabase/connect");
}

export async function fetchSupabaseProjects(token: string) {
  return adminFetch<{ projects: SupabaseProjectRow[] }>(token, "GET", "/admin/supabase/projects");
}

export async function applySupabaseProject(token: string, ref: string) {
  return adminFetch<{
    ok: boolean;
    applied: { ref: string; name: string; supabase_url: string; anon_key_preview: string };
  }>(token, "POST", "/admin/supabase/apply", { ref });
}

export async function saveSupabaseTestCredentials(
  token: string,
  email: string,
  password: string,
) {
  return adminFetch<{ ok: boolean; saved: { email: string } }>(
    token,
    "POST",
    "/admin/supabase/test-credentials",
    { email, password },
  );
}

export async function disconnectSupabase(token: string) {
  return adminFetch<{ ok: boolean }>(token, "POST", "/admin/supabase/disconnect");
}

export interface SupabaseLocalMigration {
  version: string;
  filename: string;
}

export interface SupabaseMigrationRow {
  version: string;
  filename: string;
  applied: boolean;
}

export interface SupabaseMigrationFileRow {
  version: string;
  filename: string;
  tables: string[];
}

export type SupabaseMigrationSyncStatus = "synced" | "local_only" | "remote_only";

export interface SupabaseTableCompareRow {
  name: string;
  local: boolean;
  remote: boolean;
  status: SupabaseMigrationSyncStatus;
  source_files: string[];
  rls_enabled?: boolean;
  policy_count?: number;
  local_policies: string[];
  remote_policies: string[];
}

export interface SupabaseTableRlsStatus {
  name: string;
  rls_enabled: boolean;
  policy_count: number;
  policies: string[];
}

export interface SupabaseMigrationDirCandidate {
  path: string;
  count: number;
}

export interface SupabaseMigrationDirs {
  current: string;
  current_readable?: boolean;
  candidates: SupabaseMigrationDirCandidate[];
}

export interface SupabaseMigrationStatus {
  migration_files: SupabaseMigrationFileRow[];
  table_comparison: SupabaseTableCompareRow[];
  table_summary: {
    local: number;
    remote: number;
    synced: number;
    pending: number;
  };
  tables: SupabaseTableRlsStatus[];
  pending_count: number;
  migrations_dir?: string;
}

export interface SupabaseMigrationBrowse {
  path: string;
  parent: string | null;
  migration_count: number;
  entries: Array<{ name: string; path: string; has_children: boolean }>;
}

export async function fetchSupabaseMigrationBrowse(token: string, path = "") {
  const q = path ? `?path=${encodeURIComponent(path)}` : "";
  return adminFetch<SupabaseMigrationBrowse>(token, "GET", `/admin/supabase/migrations/browse${q}`);
}

export async function fetchSupabaseMigrationDirs(token: string) {
  return adminFetch<SupabaseMigrationDirs>(token, "GET", "/admin/supabase/migrations/dirs");
}

export async function saveSupabaseMigrationDir(token: string, dir: string) {
  return adminFetch<{ ok: boolean; dir: string }>(
    token,
    "POST",
    "/admin/supabase/migrations/dir",
    { dir },
  );
}

function migrationDirQuery(dir?: string): string {
  return dir ? `&dir=${encodeURIComponent(dir)}` : "";
}

export async function fetchSupabaseLocalMigrations(token: string, dir?: string) {
  const q = dir ? `?dir=${encodeURIComponent(dir)}` : "";
  return adminFetch<{ migrations: SupabaseLocalMigration[]; migrations_dir: string }>(
    token,
    "GET",
    `/admin/supabase/migrations/local${q}`,
  );
}

export async function fetchSupabaseMigrationStatus(token: string, ref: string, dir?: string) {
  const res = await fetch(
    `/admin/supabase/migrations/status?ref=${encodeURIComponent(ref)}${migrationDirQuery(dir)}`,
    { headers: authHeaders(token) },
  );
  const j = await parseJson<
    SupabaseMigrationStatus & { error?: string; needs_db_scope?: boolean }
  >(res);
  if (!res.ok) {
    return {
      ok: false as const,
      status: res.status,
      error: errText(j),
      needs_db_scope: Boolean(j?.needs_db_scope),
    };
  }
  return { ok: true as const, data: j as SupabaseMigrationStatus };
}

export async function applySupabaseMigration(
  token: string,
  ref: string,
  opts: { table?: string; applyAll?: boolean; dir?: string },
) {
  const base = opts.applyAll
    ? { ref, apply_all: true }
    : { ref, table: opts.table };
  const body = opts.dir ? { ...base, dir: opts.dir } : base;
  return adminFetch<{ ok: boolean; applied: string[]; skipped?: boolean; needs_db_scope?: boolean; partial?: string[] }>(
    token,
    "POST",
    "/admin/supabase/migrations/apply",
    body,
  );
}

export type SupabaseFunctionSyncStatus = "synced" | "local_only" | "remote_only";

export interface SupabaseFunctionCompareRow {
  slug: string;
  local: boolean;
  remote: boolean;
  status: SupabaseFunctionSyncStatus;
  file_count: number;
  local_files: string[];
  entrypoint?: string;
  remote_status?: string;
  updated_at?: string | null;
}

export interface SupabaseFunctionsStatus {
  function_comparison: SupabaseFunctionCompareRow[];
  function_summary: {
    local: number;
    remote: number;
    synced: number;
    pending: number;
  };
  pending_count: number;
  functions_dir?: string;
  remote_list_limited?: boolean;
  remote_list_error?: string;
}

export interface SupabaseFunctionsDirs {
  current: string;
  candidates: Array<{ path: string; count: number }>;
}

export interface SupabaseFunctionsBrowse {
  path: string;
  parent: string | null;
  function_count: number;
  entries: Array<{ name: string; path: string; has_children: boolean }>;
}

export async function fetchSupabaseFunctionsBrowse(token: string, path = "") {
  const q = path ? `?path=${encodeURIComponent(path)}` : "";
  return adminFetch<SupabaseFunctionsBrowse>(token, "GET", `/admin/supabase/functions/browse${q}`);
}

export async function fetchSupabaseFunctionsDirs(token: string) {
  return adminFetch<SupabaseFunctionsDirs>(token, "GET", "/admin/supabase/functions/dirs");
}

export async function saveSupabaseFunctionsDir(token: string, dir: string) {
  return adminFetch<{ ok: boolean; dir: string }>(
    token,
    "POST",
    "/admin/supabase/functions/dir",
    { dir },
  );
}

function functionsDirQuery(dir?: string): string {
  return dir ? `&dir=${encodeURIComponent(dir)}` : "";
}

export async function fetchSupabaseFunctionsStatus(token: string, ref: string, dir?: string) {
  const res = await fetch(
    `/admin/supabase/functions/status?ref=${encodeURIComponent(ref)}${functionsDirQuery(dir)}`,
    { headers: authHeaders(token) },
  );
  const j = await parseJson<
    SupabaseFunctionsStatus & { error?: string; needs_functions_scope?: boolean }
  >(res);
  if (!res.ok) {
    return {
      ok: false as const,
      status: res.status,
      error: errText(j),
      needs_functions_scope: Boolean(j?.needs_functions_scope),
    };
  }
  return { ok: true as const, data: j as SupabaseFunctionsStatus };
}

export async function deploySupabaseFunction(
  token: string,
  ref: string,
  opts: { slug?: string; deployAll?: boolean; dir?: string },
) {
  const base = opts.deployAll ? { ref, deploy_all: true } : { ref, slug: opts.slug };
  const body = opts.dir ? { ...base, dir: opts.dir } : base;
  return adminFetch<{
    ok: boolean;
    deployed: string[];
    needs_functions_scope?: boolean;
    partial?: string[];
  }>(token, "POST", "/admin/supabase/functions/deploy", body);
}

export async function fetchWorkerDevStatus(token: string, dir?: string) {
  const q = dir ? `?dir=${encodeURIComponent(dir)}` : "";
  return adminFetch<{ running: boolean; pid: number | null; healthy: boolean }>(
    token,
    "GET",
    `/admin/worker/dev/status${q}`,
  );
}

export async function startWorkerDev(token: string, dir?: string) {
  const q = dir ? `?dir=${encodeURIComponent(dir)}` : "";
  return adminFetch<{ ok: boolean; already_running: boolean }>(
    token,
    "POST",
    `/admin/worker/dev/start${q}`,
  );
}

export function buildInvokeUrl(
  accountId: string,
  gateway: string,
  providerSlug: string,
  path: string,
): string {
  if (!gateway || !providerSlug) return "";
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gateway}/custom-${providerSlug}${path}`;
}
