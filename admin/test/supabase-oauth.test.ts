import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { generatePkce } from "../src/supabase-oauth-pkce";
import { unrecognizedClientIdHelp, validateOAuthRedirectUri } from "../src/supabase-oauth-probe";
import { pickAnonKey, projectUrl } from "../src/supabase-management";
import { setWranglerVars } from "../src/wrangler-toml-write";

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

describe("wrangler-toml-write", () => {
  it("setWranglerVars updates existing SUPABASE_URL", () => {
    const toml = `[vars]\nSUPABASE_URL = "https://old.supabase.co"\n`;
    const next = setWranglerVars(toml, { SUPABASE_URL: "https://new.supabase.co" });
    expect(next).toContain('SUPABASE_URL = "https://new.supabase.co"');
    expect(next).not.toContain("old.supabase.co");
  });
});
