import { env } from "./env";
import {
  readSupabaseOAuthTokens,
  writeSupabaseOAuthTokens,
  type SupabaseOAuthTokens,
} from "./supabase-oauth-store";

const API = "https://api.supabase.com/v1";

export interface SupabaseProject {
  id: string;
  ref: string;
  name: string;
  organization_id: string;
  region?: string;
}

export interface SupabaseProjectConfig {
  ref: string;
  name: string;
  supabase_url: string;
  anon_key: string;
}

interface ApiKeyRow {
  name?: string;
  type?: string;
  api_key?: string;
}

async function managementFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...init?.headers,
      },
    });
  } catch (e) {
    return { ok: false, status: 0, error: (e as Error).message };
  }
  const json = (await res.json().catch(() => ({}))) as T & {
    message?: string;
    error?: string;
  };
  if (!res.ok) {
    const msg = json.message || json.error || `Management API ${res.status}`;
    return { ok: false, status: res.status, error: msg };
  }
  return { ok: true, data: json };
}

export function projectUrl(ref: string): string {
  return `https://${ref}.supabase.co`;
}

export function pickAnonKey(rows: ApiKeyRow[]): string | null {
  const anon =
    rows.find((k) => k.name === "anon") ??
    rows.find((k) => k.type === "legacy" && k.name === "anon") ??
    rows.find((k) => k.name?.toLowerCase().includes("anon"));
  return anon?.api_key ?? null;
}

export async function exchangeOAuthCode(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<{ ok: true; tokens: SupabaseOAuthTokens } | { ok: false; error: string }> {
  const clientId = env.SUPABASE_OAUTH_CLIENT_ID;
  const clientSecret = env.SUPABASE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { ok: false, error: "未配置 SUPABASE_OAUTH_CLIENT_ID / SUPABASE_OAUTH_CLIENT_SECRET" };
  }

  let res: Response;
  try {
    res = await fetch(`${API}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: params.code,
        redirect_uri: params.redirectUri,
        code_verifier: params.codeVerifier,
      }),
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error_description?: string;
    message?: string;
  };

  if (!res.ok || !json.access_token || !json.refresh_token) {
    return {
      ok: false,
      error: json.error_description || json.message || `OAuth token 交换失败 (${res.status})`,
    };
  }

  const expiresIn = json.expires_in ?? 3600;
  return {
    ok: true,
    tokens: {
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_at: Date.now() + expiresIn * 1000,
      token_type: "bearer",
    },
  };
}

export async function refreshManagementToken(
  refreshToken: string,
): Promise<{ ok: true; tokens: SupabaseOAuthTokens } | { ok: false; error: string }> {
  const clientId = env.SUPABASE_OAUTH_CLIENT_ID;
  const clientSecret = env.SUPABASE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { ok: false, error: "未配置 Supabase OAuth 客户端" };
  }

  let res: Response;
  try {
    res = await fetch(`${API}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error_description?: string;
  };

  if (!res.ok || !json.access_token) {
    return {
      ok: false,
      error: json.error_description || `刷新 token 失败 (${res.status})`,
    };
  }

  const expiresIn = json.expires_in ?? 3600;
  return {
    ok: true,
    tokens: {
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? refreshToken,
      expires_at: Date.now() + expiresIn * 1000,
    },
  };
}

export async function getValidManagementToken(): Promise<
  { ok: true; accessToken: string } | { ok: false; error: string }
> {
  const stored = readSupabaseOAuthTokens();
  if (!stored) return { ok: false, error: "未连接 Supabase，请先授权" };

  if (stored.expires_at > Date.now() + 60_000) {
    return { ok: true, accessToken: stored.access_token };
  }

  const refreshed = await refreshManagementToken(stored.refresh_token);
  if (!refreshed.ok) return refreshed;
  writeSupabaseOAuthTokens(refreshed.tokens);
  return { ok: true, accessToken: refreshed.tokens.access_token };
}

export interface SupabaseAccountSummary {
  primary_email: string | null;
  username: string | null;
  projects_count: number;
  test_email: string | null;
}

export async function fetchSupabaseProfile(): Promise<
  | { ok: true; profile: { primary_email: string | null; username: string | null } }
  | { ok: false; error: string }
> {
  const token = await getValidManagementToken();
  if (!token.ok) return token;

  const res = await managementFetch<{
    primary_email?: string;
    username?: string;
  }>("/profile", token.accessToken);
  if (!res.ok) return res;

  return {
    ok: true,
    profile: {
      primary_email: res.data.primary_email ?? null,
      username: res.data.username ?? null,
    },
  };
}

export async function buildSupabaseAccountSummary(): Promise<
  { ok: true; account: SupabaseAccountSummary } | { ok: false; error: string }
> {
  const token = await getValidManagementToken();
  if (!token.ok) return token;

  const projects = await listSupabaseProjects();
  if (!projects.ok) return projects;

  return {
    ok: true,
    account: {
      primary_email: null,
      username: null,
      projects_count: projects.projects.length,
      test_email: env.SUPABASE_TEST_EMAIL || null,
    },
  };
}

export async function listSupabaseProjects(): Promise<
  { ok: true; projects: SupabaseProject[] } | { ok: false; error: string }
> {
  const token = await getValidManagementToken();
  if (!token.ok) return token;

  const res = await managementFetch<SupabaseProject[]>("/projects", token.accessToken);
  if (!res.ok) return res;
  return { ok: true, projects: Array.isArray(res.data) ? res.data : [] };
}

export async function fetchProjectConfig(
  ref: string,
): Promise<{ ok: true; config: SupabaseProjectConfig } | { ok: false; error: string }> {
  const token = await getValidManagementToken();
  if (!token.ok) return token;

  const projects = await listSupabaseProjects();
  if (!projects.ok) return projects;
  const project = projects.projects.find((p) => p.ref === ref);
  if (!project) return { ok: false, error: `未找到项目 ref=${ref}` };

  const keysRes = await managementFetch<ApiKeyRow[]>(
    `/projects/${encodeURIComponent(ref)}/api-keys?reveal=true`,
    token.accessToken,
  );
  if (!keysRes.ok) return keysRes;

  const anon = pickAnonKey(Array.isArray(keysRes.data) ? keysRes.data : []);
  if (!anon) return { ok: false, error: "未能读取 anon API key（检查 OAuth 权限）" };

  return {
    ok: true,
    config: {
      ref: project.ref,
      name: project.name,
      supabase_url: projectUrl(project.ref),
      anon_key: anon,
    },
  };
}

export interface RemoteMigrationRow {
  version?: string;
  name?: string;
  inserted_at?: string;
}

function databasePermissionHint(status: number, msg: string): boolean {
  return status === 403 || /scope|permission|unauthorized|forbidden/i.test(msg);
}

function isAlreadyAppliedSqlError(error: string): boolean {
  return (
    /already exists/i.test(error) ||
    /duplicate key/i.test(error) ||
    /\b42710\b/.test(error) ||
    /\b42P07\b/.test(error)
  );
}

export async function listDatabaseMigrations(
  ref: string,
): Promise<
  | { ok: true; migrations: RemoteMigrationRow[] }
  | { ok: false; error: string; needs_db_scope?: boolean }
> {
  const token = await getValidManagementToken();
  if (!token.ok) return token;

  const res = await managementFetch<RemoteMigrationRow[]>(
    `/projects/${encodeURIComponent(ref)}/database/migrations`,
    token.accessToken,
  );
  if (!res.ok) {
    return {
      ok: false,
      error: res.error,
      needs_db_scope: databasePermissionHint(res.status, res.error),
    };
  }
  return { ok: true, migrations: Array.isArray(res.data) ? res.data : [] };
}

export async function applyDatabaseMigration(
  ref: string,
  name: string,
  query: string,
): Promise<
  { ok: true; skipped?: boolean } | { ok: false; error: string; needs_db_scope?: boolean }
> {
  const token = await getValidManagementToken();
  if (!token.ok) return token;

  const mig = await managementFetch<unknown>(
    `/projects/${encodeURIComponent(ref)}/database/migrations`,
    token.accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, query }),
    },
  );
  if (mig.ok) return { ok: true };

  if (isAlreadyAppliedSqlError(mig.error)) {
    await recordMigrationVersion(ref, name);
    return { ok: true, skipped: true };
  }

  const queryRes = await managementFetch<unknown>(
    `/projects/${encodeURIComponent(ref)}/database/query`,
    token.accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    },
  );
  if (queryRes.ok) {
    await recordMigrationVersion(ref, name);
    return { ok: true };
  }

  if (isAlreadyAppliedSqlError(queryRes.error)) {
    await recordMigrationVersion(ref, name);
    return { ok: true, skipped: true };
  }

  const err = queryRes.error || mig.error;
  return {
    ok: false,
    error: err,
    needs_db_scope: databasePermissionHint(queryRes.status, err) || databasePermissionHint(mig.status, mig.error),
  };
}

function isSafeMigrationVersion(version: string): boolean {
  return /^(?:\d+_[\w.-]+|tbl_[\w.-]+)$/i.test(version);
}

async function recordMigrationVersion(ref: string, version: string): Promise<void> {
  if (!isSafeMigrationVersion(version)) return;
  const safe = version.replace(/'/g, "''");
  await runProjectDatabaseQuery(
    ref,
    `insert into supabase_migrations.schema_migrations (version) values ('${safe}') on conflict (version) do nothing`,
  );
}

export async function runProjectDatabaseQuery(
  ref: string,
  query: string,
  opts?: { readOnly?: boolean },
): Promise<{ ok: true; result: unknown } | { ok: false; error: string; needs_db_scope?: boolean }> {
  const token = await getValidManagementToken();
  if (!token.ok) return token;

  const path = opts?.readOnly
    ? `/projects/${encodeURIComponent(ref)}/database/query/read-only`
    : `/projects/${encodeURIComponent(ref)}/database/query`;

  const res = await managementFetch<unknown>(path, token.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    return {
      ok: false,
      error: res.error,
      needs_db_scope: databasePermissionHint(res.status, res.error),
    };
  }
  return { ok: true, result: res.data };
}

export interface RemoteFunctionRow {
  id?: string;
  slug: string;
  name?: string;
  status?: string;
  verify_jwt?: boolean;
  updated_at?: string | null;
}

function functionsPermissionHint(status: number, msg: string): boolean {
  return status === 403 || /scope|permission|unauthorized|forbidden/i.test(msg);
}

export function functionsPermissionHintForTest(status: number, msg: string): boolean {
  return functionsPermissionHint(status, msg);
}

export async function listProjectFunctions(
  ref: string,
): Promise<
  | { ok: true; functions: RemoteFunctionRow[] }
  | { ok: false; error: string; needs_functions_scope?: boolean; status?: number }
> {
  const token = await getValidManagementToken();
  if (!token.ok) return token;

  const res = await managementFetch<RemoteFunctionRow[]>(
    `/projects/${encodeURIComponent(ref)}/functions`,
    token.accessToken,
  );
  if (!res.ok) {
    return {
      ok: false,
      error: res.error,
      status: res.status,
      needs_functions_scope: functionsPermissionHint(res.status, res.error),
    };
  }
  const rows = Array.isArray(res.data) ? res.data : [];
  const functions: RemoteFunctionRow[] = [];
  for (const row of rows) {
    const slug = String(row.slug ?? row.name ?? "").trim();
    if (!slug) continue;
    functions.push({
      slug,
      name: row.name,
      status: row.status,
      verify_jwt: row.verify_jwt,
      updated_at: row.updated_at ?? null,
    });
  }
  return { ok: true, functions };
}

export async function deployProjectFunction(
  ref: string,
  slug: string,
  files: Array<{ relativePath: string; content: Buffer }>,
): Promise<
  { ok: true; slug: string } | { ok: false; error: string; needs_functions_scope?: boolean; status?: number }
> {
  const token = await getValidManagementToken();
  if (!token.ok) return token;

  if (!files.some((f) => f.relativePath === "index.ts")) {
    return { ok: false, error: "部署包缺少 index.ts" };
  }

  const importMap = files.find(
    (f) => f.relativePath === "deno.json" || f.relativePath === "import_map.json",
  );
  const metadata: Record<string, unknown> = {
    entrypoint_path: "index.ts",
    name: slug,
    verify_jwt: true,
  };
  if (importMap) metadata.import_map_path = importMap.relativePath;

  const form = new FormData();
  form.append("metadata", JSON.stringify(metadata));
  for (const file of files) {
    const bytes = new Uint8Array(file.content);
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    form.append("file", blob, file.relativePath);
  }

  let res: Response;
  try {
    res = await fetch(
      `${API}/projects/${encodeURIComponent(ref)}/functions/deploy?slug=${encodeURIComponent(slug)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
        body: form,
      },
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const json = (await res.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
    slug?: string;
  };
  if (!res.ok) {
    const msg = json.message || json.error || `部署 function 失败 (${res.status})`;
    return {
      ok: false,
      error: msg,
      status: res.status,
      needs_functions_scope: functionsPermissionHint(res.status, msg),
    };
  }

  return { ok: true, slug: json.slug ?? slug };
}
