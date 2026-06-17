import { generatePkce } from "./supabase-oauth-pkce";

const AUTHORIZE = "https://api.supabase.com/v1/oauth/authorize";

/** Organization 级 OAuth App 管理页（非项目 Auth → OAuth） */
export const SUPABASE_ORG_OAUTH_APPS_URL = "https://supabase.com/dashboard/org/_/apps";

/** Supabase 规则：除 localhost 外须 HTTPS；127.0.0.1 不算 localhost */
export const DEFAULT_DEV_OAUTH_REDIRECT =
  "http://localhost:5173/admin/supabase/oauth/callback";

export function isOAuthRedirectUriAllowed(redirectUri: string): boolean {
  try {
    const u = new URL(redirectUri);
    if (u.protocol === "https:") return true;
    return u.protocol === "http:" && u.hostname === "localhost";
  } catch {
    return false;
  }
}

export function validateOAuthRedirectUri(redirectUri: string): string | null {
  try {
    const u = new URL(redirectUri);
    if (isOAuthRedirectUriAllowed(redirectUri)) return null;

    if (u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "[::1]")) {
      return [
        "Supabase 仅对 hostname localhost 放行 HTTP，127.0.0.1 须用 HTTPS。",
        `请改用 ${DEFAULT_DEV_OAUTH_REDIRECT}，并通过 http://localhost:5173 访问前端。`,
      ].join(" ");
    }

    return [
      "Redirect URI 须为 HTTPS，或本地开发使用 http://localhost/...",
      `推荐 ${DEFAULT_DEV_OAUTH_REDIRECT}`,
    ].join(" ");
  } catch {
    return "SUPABASE_OAUTH_REDIRECT_URI 不是合法 URL";
  }
}

export function unrecognizedClientIdHelp(): string {
  return [
    "Supabase 不识别该 client_id。",
    "请在 Organization Settings → OAuth Apps 创建集成应用（不是项目内 Authentication → OAuth Apps）。",
    `Redirect URI 须与 SUPABASE_OAUTH_REDIRECT_URI 完全一致（本地推荐 ${DEFAULT_DEV_OAUTH_REDIRECT}）。`,
  ].join(" ");
}

/** 探测 client_id 是否已在 Management OAuth 注册（422 Unrecognized client_id = 未注册） */
export async function probeOAuthClientRegistration(
  clientId: string,
  redirectUri: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!clientId || !redirectUri) {
    return { ok: false, error: "缺少 client_id 或 redirect_uri" };
  }

  const uriErr = validateOAuthRedirectUri(redirectUri);
  if (uriErr) return { ok: false, error: uriErr };

  const { codeChallenge } = generatePkce();
  const url = new URL(AUTHORIZE);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", "probe");
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  let res: Response;
  try {
    res = await fetch(url.toString(), { redirect: "manual" });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  if (res.status >= 300 && res.status < 400) {
    return { ok: true };
  }

  const json = (await res.json().catch(() => ({}))) as { message?: string };
  const msg = json.message ?? `authorize HTTP ${res.status}`;

  if (msg === "Unrecognized client_id") {
    return { ok: false, error: unrecognizedClientIdHelp() };
  }

  if (msg.toLowerCase().includes("https")) {
    return { ok: false, error: `${msg}。请使用 ${DEFAULT_DEV_OAUTH_REDIRECT}` };
  }

  if (!res.ok) {
    return { ok: false, error: msg };
  }

  return { ok: true };
}

export function oauthCookieSecure(redirectUri: string): boolean {
  try {
    return new URL(redirectUri).protocol === "https:";
  } catch {
    return false;
  }
}
