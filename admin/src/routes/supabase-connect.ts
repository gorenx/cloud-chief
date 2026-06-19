import { Hono } from "hono";
import fs from "node:fs";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { adminAuth } from "../auth";
import { env, reloadEnv, setEnvFileValue, workerRoot } from "../env";
import { clearWorkerRuntimeCache } from "../worker-runtime";
import { writeWranglerVarsAll } from "../wrangler-toml-write";
import { generatePkce, randomOAuthState } from "../supabase-oauth-pkce";
import {
  oauthCookieSecure,
  probeOAuthClientRegistration,
  SUPABASE_ORG_OAUTH_APPS_URL,
  validateOAuthRedirectUri,
} from "../supabase-oauth-probe";
import {
  clearSupabaseOAuthTokens,
  readSupabaseOAuthTokens,
  writeSupabaseOAuthTokens,
} from "../supabase-oauth-store";
import {
  buildSupabaseAccountSummary,
  exchangeOAuthCode,
  fetchProjectConfig,
  listSupabaseProjects,
} from "../supabase-management";
import {
  applyFunctionMigration,
  applyPendingMigrations,
  applyPendingTables,
  applyTableMigration,
  browseMigrationsDir,
  getConfiguredMigrationsDir,
  getMigrationStatus,
  isMigrationsDirReadable,
  listLocalMigrations,
  listMigrationDirCandidates,
  resolveMigrationsDir,
} from "../supabase-schema";
import {
  browseFunctionsDir,
  deployLocalFunction,
  deployPendingFunctions,
  getConfiguredFunctionsDir,
  getFunctionsStatus,
  listFunctionDirCandidates,
  resolveFunctionsDir,
} from "../supabase-functions";

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

function assertLocalFsAccess(): string | null {
  if (env.ADMIN_BIND !== "127.0.0.1" && env.ADMIN_BIND !== "localhost") {
    return "目录浏览仅允许 ADMIN_BIND=127.0.0.1（或 localhost）时使用";
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

  const httpsErr = validateOAuthRedirectUri(env.SUPABASE_OAUTH_REDIRECT_URI);
  if (httpsErr) return c.json({ error: httpsErr }, 400);

  const { codeVerifier, codeChallenge } = generatePkce();
  const state = randomOAuthState();

  const cookieOpts = {
    path: COOKIE_PATH,
    httpOnly: true,
    secure: oauthCookieSecure(env.SUPABASE_OAUTH_REDIRECT_URI),
    sameSite: "Lax" as const,
    maxAge: COOKIE_MAX_AGE,
  };
  setCookie(c, "sb_oauth_state", state, cookieOpts);
  setCookie(c, "sb_code_verifier", codeVerifier, cookieOpts);

  const probe = await probeOAuthClientRegistration(
    env.SUPABASE_OAUTH_CLIENT_ID,
    env.SUPABASE_OAUTH_REDIRECT_URI,
  );
  if (!probe.ok) {
    return c.json({ error: probe.error, docs_url: SUPABASE_ORG_OAUTH_APPS_URL }, 400);
  }

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

function localTestAccount() {
  return {
    email: env.SUPABASE_TEST_EMAIL || null,
    configured: Boolean(
      env.SUPABASE_ANON_KEY && env.SUPABASE_TEST_EMAIL && env.SUPABASE_TEST_PASSWORD,
    ),
  };
}

supabaseConnect.get("/status", adminAuth, async (c) => {
  const tokens = readSupabaseOAuthTokens();
  const connected = Boolean(tokens?.access_token);

  let account: {
    primary_email: string | null;
    username: string | null;
    projects_count: number;
    test_email: string | null;
  } | null = null;
  if (connected) {
    const summary = await buildSupabaseAccountSummary();
    account = summary.ok
      ? summary.account
      : {
          primary_email: null,
          username: null,
          projects_count: 0,
          test_email: env.SUPABASE_TEST_EMAIL || null,
        };
  }

  return c.json({
    oauth_configured: oauthConfigured(),
    connected,
    account,
    local_test: localTestAccount(),
    expires_at: tokens?.expires_at ?? null,
    redirect_uri: env.SUPABASE_OAUTH_REDIRECT_URI || null,
    client_id_hint: env.SUPABASE_OAUTH_CLIENT_ID
      ? `${env.SUPABASE_OAUTH_CLIENT_ID.slice(0, 8)}…`
      : null,
    oauth_apps_url: SUPABASE_ORG_OAUTH_APPS_URL,
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

  const wr = writeWranglerVarsAll(workerRoot, {
    SUPABASE_URL: cfg.config.supabase_url,
    JWT_AUDIENCE: "authenticated",
  });
  if (!wr.ok) return c.json({ error: `写入 wrangler.toml 失败: ${wr.error}` }, 500);

  reloadEnv({ quiet: false });
  clearWorkerRuntimeCache();

  return c.json({
    ok: true,
    applied: {
      ref: cfg.config.ref,
      name: cfg.config.name,
      supabase_url: cfg.config.supabase_url,
      anon_key_preview: `${cfg.config.anon_key.slice(0, 8)}…`,
      worker_dirs: wr.updated,
    },
  });
});

supabaseConnect.post("/test-credentials", adminAuth, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  const email = body.email?.trim();
  const password = body.password ?? "";
  if (!email) return c.json({ error: "缺少 email" }, 400);
  if (!password) return c.json({ error: "缺少 password" }, 400);

  if (!setEnvFileValue("SUPABASE_TEST_EMAIL", email)) {
    return c.json({ error: "写入 admin/.env SUPABASE_TEST_EMAIL 失败" }, 500);
  }
  if (!setEnvFileValue("SUPABASE_TEST_PASSWORD", password)) {
    return c.json({ error: "写入 admin/.env SUPABASE_TEST_PASSWORD 失败" }, 500);
  }

  reloadEnv({ quiet: false });

  return c.json({
    ok: true,
    saved: { email },
  });
});

supabaseConnect.post("/disconnect", adminAuth, (c) => {
  clearSupabaseOAuthTokens();
  return c.json({ ok: true });
});

supabaseConnect.get("/migrations/browse", adminAuth, (c) => {
  const bindErr = assertLocalFsAccess();
  if (bindErr) return c.json({ error: bindErr }, 403);

  const browsePath = c.req.query("path")?.trim() || undefined;
  const result = browseMigrationsDir(browsePath);
  if (!result.ok) return c.json({ error: result.error }, 400);
  return c.json(result);
});

supabaseConnect.get("/migrations/dirs", adminAuth, (c) => {
  const current = getConfiguredMigrationsDir();
  const readable = isMigrationsDirReadable(current);
  return c.json({
    current,
    current_readable: readable,
    candidates: listMigrationDirCandidates(),
  });
});

supabaseConnect.post("/migrations/dir", adminAuth, async (c) => {
  const bindErr = assertLocalFsAccess();
  if (bindErr) return c.json({ error: bindErr }, 403);

  const body = (await c.req.json().catch(() => ({}))) as { dir?: string };
  const raw = body.dir?.trim();
  if (!raw) return c.json({ error: "缺少 dir" }, 400);

  const resolved = resolveMigrationsDir(raw);
  if (!resolved) {
    return c.json({ error: "无效的迁移目录" }, 400);
  }

  try {
    if (!fs.statSync(resolved).isDirectory()) {
      return c.json({ error: "路径不是目录" }, 400);
    }
  } catch {
    return c.json({ error: "目录不可读" }, 400);
  }

  if (!setEnvFileValue("SUPABASE_MIGRATIONS_DIR", resolved)) {
    return c.json({ error: "写入 admin/.env SUPABASE_MIGRATIONS_DIR 失败" }, 500);
  }
  reloadEnv({ quiet: false });

  return c.json({ ok: true, dir: resolved });
});

supabaseConnect.get("/migrations/local", adminAuth, (c) => {
  const dir = c.req.query("dir")?.trim();
  const picked = dir ? resolveMigrationsDir(dir) : getConfiguredMigrationsDir();
  if (!picked) return c.json({ error: "无效的迁移目录" }, 400);

  const migrations = listLocalMigrations(picked).map((m) => ({
    version: m.version,
    filename: m.filename,
  }));
  return c.json({
    migrations,
    migrations_dir: picked,
  });
});

supabaseConnect.get("/migrations/status", adminAuth, async (c) => {
  const ref = c.req.query("ref")?.trim();
  if (!ref) return c.json({ error: "缺少 ref" }, 400);

  const status = await getMigrationStatus(ref, c.req.query("dir")?.trim() || null);
  if (!status.ok) {
    return c.json(
      { error: status.error, needs_db_scope: status.needs_db_scope ?? false },
      status.needs_db_scope ? 403 : 502,
    );
  }
  return c.json(status);
});

supabaseConnect.post("/migrations/apply", adminAuth, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    ref?: string;
    table?: string;
    function?: string;
    apply_all?: boolean;
    dir?: string;
  };
  const ref = body.ref?.trim();
  if (!ref) return c.json({ error: "缺少 ref" }, 400);
  const migrationsDir = body.dir?.trim() || null;

  if (body.apply_all) {
    const r = await applyPendingMigrations(ref, migrationsDir);
    if (!r.ok) {
      return c.json(
        {
          error: r.error,
          needs_db_scope: r.needs_db_scope ?? false,
          partial_tables: r.partial_tables ?? [],
          partial_functions: r.partial_functions ?? [],
        },
        r.needs_db_scope ? 403 : 502,
      );
    }
    return c.json({
      ok: true,
      applied: [...r.applied_tables, ...r.applied_functions],
      applied_tables: r.applied_tables,
      applied_functions: r.applied_functions,
    });
  }

  const fn = body.function?.trim();
  if (fn) {
    const r = await applyFunctionMigration(ref, fn, migrationsDir);
    if (!r.ok) {
      return c.json(
        { error: r.error, needs_db_scope: r.needs_db_scope ?? false },
        r.needs_db_scope ? 403 : 502,
      );
    }
    return c.json({ ok: true, applied: [r.function], skipped: r.skipped ?? false });
  }

  const table = body.table?.trim();
  if (!table) return c.json({ error: "缺少 table、function 或 apply_all" }, 400);

  const r = await applyTableMigration(ref, table, migrationsDir);
  if (!r.ok) {
    return c.json(
      { error: r.error, needs_db_scope: r.needs_db_scope ?? false },
      r.needs_db_scope ? 403 : 502,
    );
  }
  return c.json({ ok: true, applied: [r.table], skipped: r.skipped ?? false });
});

supabaseConnect.get("/functions/browse", adminAuth, (c) => {
  const bindErr = assertLocalFsAccess();
  if (bindErr) return c.json({ error: bindErr }, 403);

  const browsePath = c.req.query("path")?.trim() || undefined;
  const result = browseFunctionsDir(browsePath);
  if (!result.ok) return c.json({ error: result.error }, 400);
  return c.json(result);
});

supabaseConnect.get("/functions/dirs", adminAuth, (c) => {
  return c.json({
    current: getConfiguredFunctionsDir(),
    candidates: listFunctionDirCandidates(),
  });
});

supabaseConnect.post("/functions/dir", adminAuth, async (c) => {
  const bindErr = assertLocalFsAccess();
  if (bindErr) return c.json({ error: bindErr }, 403);

  const body = (await c.req.json().catch(() => ({}))) as { dir?: string };
  const raw = body.dir?.trim();
  if (!raw) return c.json({ error: "缺少 dir" }, 400);

  const resolved = resolveFunctionsDir(raw);
  if (!resolved) {
    return c.json({ error: "无效的 Functions 目录" }, 400);
  }

  try {
    if (!fs.statSync(resolved).isDirectory()) {
      return c.json({ error: "路径不是目录" }, 400);
    }
  } catch {
    return c.json({ error: "目录不可读" }, 400);
  }

  if (!setEnvFileValue("SUPABASE_FUNCTIONS_DIR", resolved)) {
    return c.json({ error: "写入 admin/.env SUPABASE_FUNCTIONS_DIR 失败" }, 500);
  }
  reloadEnv({ quiet: false });

  return c.json({ ok: true, dir: resolved });
});

supabaseConnect.get("/functions/status", adminAuth, async (c) => {
  const ref = c.req.query("ref")?.trim();
  if (!ref) return c.json({ error: "缺少 ref" }, 400);

  const status = await getFunctionsStatus(ref, c.req.query("dir")?.trim() || null);
  if (!status.ok) {
    return c.json(
      { error: status.error, needs_functions_scope: status.needs_functions_scope ?? false },
      status.needs_functions_scope ? 403 : 502,
    );
  }
  return c.json(status);
});

supabaseConnect.post("/functions/deploy", adminAuth, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    ref?: string;
    slug?: string;
    deploy_all?: boolean;
    dir?: string;
  };
  const ref = body.ref?.trim();
  if (!ref) return c.json({ error: "缺少 ref" }, 400);
  const functionsDir = body.dir?.trim() || null;

  if (body.deploy_all) {
    const r = await deployPendingFunctions(ref, functionsDir);
    if (!r.ok) {
      return c.json(
        {
          error: r.error,
          needs_functions_scope: r.needs_functions_scope ?? false,
          partial: r.partial ?? [],
        },
        r.needs_functions_scope ? 403 : 502,
      );
    }
    return c.json({ ok: true, deployed: r.deployed });
  }

  const slug = body.slug?.trim();
  if (!slug) return c.json({ error: "缺少 slug 或 deploy_all" }, 400);

  const r = await deployLocalFunction(ref, slug, functionsDir);
  if (!r.ok) {
    return c.json(
      { error: r.error, needs_functions_scope: r.needs_functions_scope ?? false },
      r.needs_functions_scope ? 403 : 502,
    );
  }
  return c.json({ ok: true, deployed: [r.slug] });
});
