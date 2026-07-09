import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it, expect } from "vitest";
import {
  loadCfLists,
  pickDefaultGateway,
  pickDefaultProvider,
  RESPONSES_API_PATH,
} from "../src/cf-resolve";
import { closeDatabase, initDatabase } from "../src/db/connection";
import { env } from "../src/env";

describe("cf-resolve", () => {
  let dbPath = "";

  beforeEach(() => {
    closeDatabase();
    dbPath = path.join(os.tmpdir(), `cf-resolve-${Date.now()}-${Math.random()}.db`);
    env.ADMIN_DB_PATH = dbPath;
    process.env.ADMIN_DB_PATH = dbPath;
    env.CF_ACCOUNT_ID = "acct";
    env.CF_API_TOKEN = "token";
    initDatabase();
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    delete process.env.ADMIN_DB_PATH;
  });

  it("pickDefaultGateway prefers is_default", () => {
    const g = pickDefaultGateway([
      { id: "gw-a" },
      { id: "gw-b", is_default: true },
    ]);
    expect(g?.id).toBe("gw-b");
  });

  it("pickDefaultGateway skips builtin default when possible", () => {
    const g = pickDefaultGateway([{ id: "default" }, { id: "qwen-gw" }]);
    expect(g?.id).toBe("qwen-gw");
  });

  it("pickDefaultProvider picks first enabled slug", () => {
    const p = pickDefaultProvider([
      { slug: "disabled", base_url: "https://a", enable: false },
      { slug: "active", base_url: "https://b", enable: true },
    ]);
    expect(p?.slug).toBe("active");
  });

  it("RESPONSES_API_PATH is fixed", () => {
    expect(RESPONSES_API_PATH).toBe("/responses");
  });

  it("returns local snapshot when Cloudflare refresh fails", async () => {
    const realFetch = globalThis.fetch;
    let fail = false;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (fail) {
        return new Response(JSON.stringify({ success: false, errors: [{ message: "offline" }] }), {
          status: 503,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("custom-providers")) {
        return new Response(
          JSON.stringify({ success: true, result: [{ id: "p1", slug: "p1", base_url: "https://p1" }] }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ success: true, result: [{ id: "gw1" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const first = await loadCfLists({ refresh: true });
      expect(first.gateways.map((g) => g.id)).toEqual(["gw1"]);
      fail = true;
      const second = await loadCfLists({ refresh: true });
      expect(second.gateways.map((g) => g.id)).toEqual(["gw1"]);
      expect(second._sync.gateways.source).toBe("local_snapshot");
      expect(second._sync.gateways.error).toContain("offline");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
