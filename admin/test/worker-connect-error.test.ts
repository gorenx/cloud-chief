import { describe, it, expect } from "vitest";
import { formatWorkerFetchError } from "../src/worker-connect-error";

describe("worker-connect-error", () => {
  it("formatWorkerFetchError explains connection refused", () => {
    const msg = formatWorkerFetchError(
      Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } }),
      "http://127.0.0.1:8788",
    );
    expect(msg).toContain("Worker 未响应");
    expect(msg).toContain("wrangler dev");
  });
});
