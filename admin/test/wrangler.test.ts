import { describe, expect, it } from "vitest";
import { env } from "../src/env";
import { buildWranglerEnv } from "../src/wrangler";

describe("buildWranglerEnv", () => {
  it("maps deprecated CF_* env vars to CLOUDFLARE_* for wrangler", () => {
    const previous = { ...env };
    Object.assign(env, {
      CF_API_TOKEN: "old-token",
      CLOUDFLARE_API_TOKEN: "",
      CF_ACCOUNT_ID: "old-account",
      CLOUDFLARE_ACCOUNT_ID: "",
    });

    try {
      const child = buildWranglerEnv({
        CF_API_TOKEN: "process-old-token",
        CF_ACCOUNT_ID: "process-old-account",
      });

      expect(child.CLOUDFLARE_API_TOKEN).toBe("old-token");
      expect(child.CLOUDFLARE_ACCOUNT_ID).toBe("old-account");
      expect(child.CF_API_TOKEN).toBeUndefined();
      expect(child.CF_ACCOUNT_ID).toBeUndefined();
    } finally {
      Object.assign(env, previous);
    }
  });
});
