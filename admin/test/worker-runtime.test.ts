import { describe, expect, it } from "vitest";
import { pickWorkerUrl, type WorkerRuntimeConfig } from "../src/worker-runtime";
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
