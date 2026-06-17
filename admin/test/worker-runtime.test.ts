import { describe, expect, it } from "vitest";
import { pickWorkerUrl, type WorkerRuntimeConfig } from "../src/worker-runtime";

function runtime(partial: Partial<WorkerRuntimeConfig>): WorkerRuntimeConfig {
  return {
    script_name: "test-worker",
    url: "http://127.0.0.1:8788",
    local_url: "http://127.0.0.1:8788",
    online_url: "https://test-worker.sub.workers.dev",
    online_available: true,
    url_source: "env",
    vars: {},
    vars_source: "wrangler",
    secret_names: [],
    cf_error: null,
    ...partial,
  };
}

describe("pickWorkerUrl", () => {
  it("returns local_url for local target", () => {
    const r = runtime({});
    expect(pickWorkerUrl(r, "local")).toEqual({ url: "http://127.0.0.1:8788" });
  });

  it("returns online_url for online target", () => {
    const r = runtime({});
    expect(pickWorkerUrl(r, "online")).toEqual({
      url: "https://test-worker.sub.workers.dev",
    });
  });

  it("errors when online unavailable", () => {
    const r = runtime({ online_url: null, online_available: false });
    const picked = pickWorkerUrl(r, "online");
    expect(picked.error).toMatch(/线上 Worker/);
    expect(picked.url).toBe("http://127.0.0.1:8788");
  });
});
