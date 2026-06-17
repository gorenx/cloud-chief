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
