import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, it, expect, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { generatePkce } from "../src/supabase-oauth-pkce";
import { unrecognizedClientIdHelp, validateOAuthRedirectUri } from "../src/supabase-oauth-probe";
import { pickAnonKey, projectUrl } from "../src/supabase-management";
import { closeDatabase, initDatabase } from "../src/db/connection";
import { getDb } from "../src/db/connection";
import {
  clearSupabaseOAuthTokens,
  readSupabaseOAuthTokens,
  writeSupabaseOAuthTokens,
} from "../src/supabase-oauth-store";
import { env } from "../src/env";
import {
  discoverWorkerDirs,
  setWranglerVars,
  writeWranglerVarsAll,
} from "../src/wrangler-toml-write";

describe("supabase-oauth-pkce", () => {
  it("generatePkce produces verifiable S256 challenge", () => {
    const { codeVerifier, codeChallenge } = generatePkce();
    expect(codeVerifier.length).toBeGreaterThan(20);
    const expected = createHash("sha256").update(codeVerifier).digest("base64url");
    expect(codeChallenge).toBe(expected);
  });
});

describe("supabase-oauth-probe", () => {
  it("unrecognizedClientIdHelp mentions Organization OAuth Apps", () => {
    expect(unrecognizedClientIdHelp()).toContain("Organization Settings");
    expect(unrecognizedClientIdHelp()).toContain("OAuth Apps");
  });

  it("validateOAuthRedirectUri allows http localhost and https", () => {
    expect(validateOAuthRedirectUri("http://127.0.0.1:5173/admin/supabase/oauth/callback")).toContain(
      "localhost",
    );
    expect(validateOAuthRedirectUri("http://localhost:5173/admin/supabase/oauth/callback")).toBeNull();
    expect(validateOAuthRedirectUri("https://127.0.0.1:5173/admin/supabase/oauth/callback")).toBeNull();
  });
});

describe("supabase-management", () => {
  it("projectUrl uses ref subdomain", () => {
    expect(projectUrl("abcd1234")).toBe("https://abcd1234.supabase.co");
  });

  it("pickAnonKey finds anon legacy key", () => {
    const key = pickAnonKey([
      { name: "service_role", api_key: "sr" },
      { name: "anon", api_key: "anon-key" },
    ]);
    expect(key).toBe("anon-key");
  });
});

describe("supabase-oauth-store", () => {
  let dbPath = "";

  beforeEach(() => {
    closeDatabase();
    dbPath = path.join(os.tmpdir(), `supabase-oauth-${Date.now()}-${Math.random()}.db`);
    env.ADMIN_DB_PATH = dbPath;
    env.ADMIN_DB_ENCRYPT = false;
    process.env.ADMIN_DB_PATH = dbPath;
    initDatabase();
  });

  afterEach(() => {
    clearSupabaseOAuthTokens();
    closeDatabase();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    delete process.env.ADMIN_DB_PATH;
  });

  it("stores Supabase OAuth tokens in SQLite", () => {
    writeSupabaseOAuthTokens({
      access_token: "access",
      refresh_token: "refresh",
      expires_at: 123,
      token_type: "bearer",
    });
    expect(readSupabaseOAuthTokens()).toEqual({
      access_token: "access",
      refresh_token: "refresh",
      expires_at: 123,
      token_type: "bearer",
    });
    const row = getDb()
      .prepare("SELECT provider, access_token FROM oauth_tokens WHERE provider = 'supabase'")
      .get() as { provider: string; access_token: string } | undefined;
    expect(row).toEqual({ provider: "supabase", access_token: "access" });
  });
});

describe("wrangler-toml-write", () => {
  it("setWranglerVars updates existing SUPABASE_URL", () => {
    const toml = `[vars]\nSUPABASE_URL = "https://old.supabase.co"\n`;
    const next = setWranglerVars(toml, { SUPABASE_URL: "https://new.supabase.co" });
    expect(next).toContain('SUPABASE_URL = "https://new.supabase.co"');
    expect(next).not.toContain("old.supabase.co");
  });

  const tempRoots: string[] = [];
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("writeWranglerVarsAll updates every worker directory", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-workers-"));
    tempRoots.push(root);
    for (const dir of ["ai-gateway-worker", "worker-revenuecat"]) {
      const abs = path.join(root, dir);
      fs.mkdirSync(abs, { recursive: true });
      fs.writeFileSync(
        path.join(abs, "wrangler.toml"),
        `[vars]\nSUPABASE_URL = "https://old.supabase.co"\n`,
      );
    }

    const dirs = discoverWorkerDirs(root);
    expect(dirs).toHaveLength(2);

    const wr = writeWranglerVarsAll(root, {
      SUPABASE_URL: "https://new.supabase.co",
      JWT_AUDIENCE: "authenticated",
    });
    expect(wr.ok).toBe(true);
    if (wr.ok) {
      expect(wr.updated).toHaveLength(2);
      for (const rel of wr.updated) {
        const text = fs.readFileSync(path.join(root, rel, "wrangler.toml"), "utf8");
        expect(text).toContain('SUPABASE_URL = "https://new.supabase.co"');
        expect(text).toContain('JWT_AUDIENCE = "authenticated"');
      }
    }
  });
});
