import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { adminAuth } from "../auth";
import { env, reloadEnv, setEnvFileValue, workerDir } from "../env";
import { generatePkce, randomOAuthState } from "../supabase-oauth-pkce";
import {
  clearSupabaseOAuthTokens,
  readSupabaseOAuthTokens,
  writeSupabaseOAuthTokens,
} from "../supabase-oauth-store";
import {
  exchangeOAuthCode,
  fetchProjectConfig,
  listSupabaseProjects,
} from "../supabase-management";
import { writeWranglerVars } from "../wrangler-toml-write";

const OAUTH_API = "https://api.supabase.com/v1/oauth/authorize";
const COOKIE_PATH = "/admin/supabase";
const COOKIE_MAX_AGE = 600;

export const supabaseConnect = new Hono();

function oauthConfigured(): boolean {
  return Boolean(
    env.SUPABASE_OAUTH_CLIENT_ID &&
      env.SUPABASE_OAUTH_CLIENT_SECRET &&
      env.SUPABASE_OAUTH_REDIRECT_URI,
  );
}

function assertLocalBind(): string | null {
  if (env.ADMIN_BIND !== "127.0.0.1" && env.ADMIN_BIND !== "localhost") {
    return "Supabase OAuth 仅允许 ADMIN_BIND=127.0.0.1（或 localhost）时使用";
  }
  return null;
}

function playgroundRedirect(query = ""): string {
  const origin = env.ADMIN_WEB_ORIGIN?.replace(/\/$/, "");
  const path = `/playground${query}`;
  return origin ? `${origin}${path}` : path;
}

function clearOAuthCookies(c: Parameters<typeof deleteCookie>[0]) {
  deleteCookie(c, "sb_oauth_state", { path: COOKIE_PATH });
  deleteCookie(c, "sb_code_verifier", { path: COOKIE_PATH });
}

// 需 ADMIN_TOKEN：发起 OAuth（PKCE），返回授权 URL
supabaseConnect.post("/connect", adminAuth, async (c) => {
  const bindErr = assertLocalBind();
  if (bindErr) return c.json({ error: bindErr }, 403);
  if (!oauthConfigured()) {
    return c.json(
      {
        error:
          "未配置 Supabase OAuth：请在 admin/.env 设置 SUPABASE_OAUTH_CLIENT_ID、SUPABASE_OAUTH_CLIENT_SECRET、SUPABASE_OAUTH_REDIRECT_URI",
      },
      503,
    );
  }

  const { codeVerifier, codeChallenge } = generatePkce();
  const state = randomOAuthState();

  const cookieOpts = {
    path: COOKIE_PATH,
    httpOnly: true,
    secure: false,
    sameSite: "Lax" as const,
    maxAge: COOKIE_MAX_AGE,
  };
  setCookie(c, "sb_oauth_state", state, cookieOpts);
  setCookie(c, "sb_code_verifier", codeVerifier, cookieOpts);

  const url = new URL(OAUTH_API);
  url.searchParams.set("client_id", env.SUPABASE_OAUTH_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", env.SUPABASE_OAUTH_REDIRECT_URI);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return c.json({ url: url.toString() });
});

// 无 Bearer：OAuth 回调，校验 cookie + PKCE，换 token 后跳转 Playground
supabaseConnect.get("/oauth/callback", async (c) => {
  const bindErr = assertLocalBind();
  if (bindErr) return c.text(bindErr, 403);

  const err = c.req.query("error");
  if (err) {
    clearOAuthCookies(c);
    return c.redirect(playgroundRedirect(`?supabase=error&reason=${encodeURIComponent(err)}`), 302);
  }

  const code = c.req.query("code");
  const state = c.req.query("state");
  const savedState = getCookie(c, "sb_oauth_state");
  const codeVerifier = getCookie(c, "sb_code_verifier");

  clearOAuthCookies(c);

  if (!code || !state || !savedState || !codeVerifier || state !== savedState) {
    return c.redirect(playgroundRedirect("?supabase=error&reason=invalid_state"), 302);
  }

  const exchanged = await exchangeOAuthCode({
    code,
    codeVerifier,
    redirectUri: env.SUPABASE_OAUTH_REDIRECT_URI,
  });

  if (!exchanged.ok) {
    return c.redirect(
      playgroundRedirect(`?supabase=error&reason=${encodeURIComponent(exchanged.error)}`),
      302,
    );
  }

  writeSupabaseOAuthTokens(exchanged.tokens);
  return c.redirect(playgroundRedirect("?supabase=connected"), 302);
});

supabaseConnect.get("/status", adminAuth, (c) => {
  const tokens = readSupabaseOAuthTokens();
  return c.json({
    oauth_configured: oauthConfigured(),
    connected: Boolean(tokens?.access_token),
    expires_at: tokens?.expires_at ?? null,
    redirect_uri: env.SUPABASE_OAUTH_REDIRECT_URI || null,
    local_only: env.ADMIN_BIND === "127.0.0.1" || env.ADMIN_BIND === "localhost",
  });
});

supabaseConnect.get("/projects", adminAuth, async (c) => {
  const r = await listSupabaseProjects();
  if (!r.ok) return c.json({ error: r.error }, r.error.includes("未连接") ? 401 : 502);
  return c.json({ projects: r.projects });
});

supabaseConnect.post("/apply", adminAuth, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { ref?: string };
  const ref = body.ref?.trim();
  if (!ref) return c.json({ error: "缺少 ref" }, 400);

  const cfg = await fetchProjectConfig(ref);
  if (!cfg.ok) return c.json({ error: cfg.error }, 502);

  if (!setEnvFileValue("SUPABASE_ANON_KEY", cfg.config.anon_key)) {
    return c.json({ error: "写入 admin/.env SUPABASE_ANON_KEY 失败" }, 500);
  }

  const wr = writeWranglerVars(workerDir, { SUPABASE_URL: cfg.config.supabase_url });
  if (!wr.ok) return c.json({ error: `写入 wrangler.toml 失败: ${wr.error}` }, 500);

  reloadEnv({ quiet: false });

  return c.json({
    ok: true,
    applied: {
      ref: cfg.config.ref,
      name: cfg.config.name,
      supabase_url: cfg.config.supabase_url,
      anon_key_preview: `${cfg.config.anon_key.slice(0, 8)}…`,
    },
  });
});

supabaseConnect.post("/disconnect", adminAuth, (c) => {
  clearSupabaseOAuthTokens();
  return c.json({ ok: true });
});
