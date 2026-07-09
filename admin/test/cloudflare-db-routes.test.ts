import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { env } from "../src/env";

const TOKEN = "test-token";

beforeEach(() => {
  env.ADMIN_TOKEN = TOKEN;
  env.CF_API_TOKEN = "cf-token";
});

describe("cloudflare db routes", () => {
  it("POST /admin/cloudflare-db/d1/databases creates D1 database", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      expect(url).toContain("/accounts/");
      expect(url).toContain("/d1/database");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify({ name: "cloud-chief-auth" }));
      return new Response(
        JSON.stringify({
          success: true,
          result: { uuid: "db-id", name: "cloud-chief-auth" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      const res = await app.request("/admin/cloudflare-db/d1/databases?dir=auth-worker", {
        method: "POST",
        headers: {
          authorization: `Bearer ${TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "cloud-chief-auth",
          binding: "DB",
          update_wrangler: false,
          apply_migrations: false,
        }),
      });

      expect(res.status).toBe(200);
      const j = (await res.json()) as {
        database: { id: string; name: string };
        binding: { binding: string; database_name: string; database_id: string };
        wrangler: { updated: boolean };
      };
      expect(j.database).toEqual({ id: "db-id", name: "cloud-chief-auth", created_at: null, version: null });
      expect(j.binding).toEqual({
        binding: "DB",
        database_name: "cloud-chief-auth",
        database_id: "db-id",
      });
      expect(j.wrangler.updated).toBe(false);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
