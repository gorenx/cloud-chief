import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pickWorkerUrl, type WorkerRuntimeConfig } from "../src/worker-runtime";
import { closeDatabase, initDatabase } from "../src/db/connection";
import { upsertCfWorker } from "../src/db/resource-store";
import { resolveWorkerFromCf } from "../src/cf-worker-resolve";
import { env } from "../src/env";
import {
  buildWorkerEndpointOptions,
  WORKER_ENDPOINT_LOCAL,
  WORKER_ENDPOINT_WORKERS_DEV,
} from "../src/worker-endpoints";

function runtime(partial: Partial<WorkerRuntimeConfig>): WorkerRuntimeConfig {
  const url_endpoints = partial.url_endpoints ?? buildWorkerEndpointOptions(
    partial.local_url ?? "http://127.0.0.1:8788",
    partial.online_url ?? "https://test-worker.sub.workers.dev",
    partial.custom_domains ?? [],
  );
  return {
    script_name: "test-worker",
    url: "http://127.0.0.1:8788",
    local_url: "http://127.0.0.1:8788",
    online_url: "https://test-worker.sub.workers.dev",
    online_available: true,
    custom_domains: [],
    url_source: "env",
    vars: {},
    vars_source: "wrangler",
    secret_names: [],
    cf_error: null,
    ...partial,
    url_endpoints: partial.url_endpoints ?? url_endpoints,
  };
}

describe("pickWorkerUrl", () => {
  it("returns local_url for local target", () => {
    const r = runtime({});
    expect(pickWorkerUrl(r, WORKER_ENDPOINT_LOCAL)).toEqual({ url: "http://127.0.0.1:8788" });
  });

  it("returns online_url for workers_dev target", () => {
    const r = runtime({});
    expect(pickWorkerUrl(r, WORKER_ENDPOINT_WORKERS_DEV)).toEqual({
      url: "https://test-worker.sub.workers.dev",
    });
    expect(pickWorkerUrl(r, "online")).toEqual({
      url: "https://test-worker.sub.workers.dev",
    });
  });

  it("returns custom domain url", () => {
    const r = runtime({
      custom_domains: ["api.example.com"],
      url_endpoints: buildWorkerEndpointOptions(
        "http://127.0.0.1:8788",
        "https://test-worker.sub.workers.dev",
        ["api.example.com"],
      ),
    });
    expect(pickWorkerUrl(r, "custom:api.example.com")).toEqual({
      url: "https://api.example.com",
    });
  });

  it("errors when workers_dev unavailable", () => {
    const r = runtime({
      online_url: null,
      online_available: false,
      url_endpoints: buildWorkerEndpointOptions("http://127.0.0.1:8788", null, []),
    });
    const picked = pickWorkerUrl(r, WORKER_ENDPOINT_WORKERS_DEV);
    expect(picked.error).toMatch(/线上 Worker/);
    expect(picked.url).toBe("http://127.0.0.1:8788");
  });
});

describe("resolveWorkerFromCf snapshot fallback", () => {
  let dbPath = "";

  beforeEach(() => {
    closeDatabase();
    dbPath = path.join(os.tmpdir(), `worker-runtime-${Date.now()}-${Math.random()}.db`);
    env.ADMIN_DB_PATH = dbPath;
    env.CF_ACCOUNT_ID = "acct";
    process.env.ADMIN_DB_PATH = dbPath;
    initDatabase();
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    delete process.env.ADMIN_DB_PATH;
  });

  it("uses cached deployed worker when CF token is unavailable", async () => {
    upsertCfWorker("acct", {
      name: "cached-worker",
      url: "https://cached.example.workers.dev",
      subdomain_enabled: true,
      vars: { DEFAULT_MODEL: "qwen3" },
      secret_names: ["SECRET"],
      compatibility_date: "2026-01-01",
      usage_model: null,
    });

    const r = await resolveWorkerFromCf("cached-worker", false);
    expect(r.ok).toBe(true);
    expect(r.url).toBe("https://cached.example.workers.dev");
    expect(r.vars.DEFAULT_MODEL).toBe("qwen3");
    expect(r.secret_names).toEqual(["SECRET"]);
    expect(r.error).toContain("本地 Worker 快照");
  });
});
