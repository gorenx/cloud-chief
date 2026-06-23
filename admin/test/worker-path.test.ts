import { describe, it, expect } from "vitest";
import {
  normalizeWorkerBaseUrl,
  normalizeWorkerPath,
  parseWorkerHttpMethod,
  resolveWorkerHttpPath,
  workerPathNeedsAuth,
} from "../src/worker-path";

const BASE = "http://127.0.0.1:8788";

describe("resolveWorkerHttpPath", () => {
  it("accepts relative paths", () => {
    expect(resolveWorkerHttpPath(BASE, "/health")).toEqual({ path: "/health" });
    expect(resolveWorkerHttpPath(BASE, "v1/responses")).toEqual({ path: "/v1/responses" });
  });

  it("accepts full URL matching worker base", () => {
    expect(resolveWorkerHttpPath(BASE, "http://127.0.0.1:8788/health")).toEqual({ path: "/health" });
  });

  it("accepts host+path without scheme", () => {
    expect(resolveWorkerHttpPath(BASE, "127.0.0.1:8788/health")).toEqual({ path: "/health" });
  });

  it("rejects foreign origin", () => {
    expect(resolveWorkerHttpPath(BASE, "http://evil.test/health")).toEqual({
      error: "URL 必须指向当前 Worker",
    });
  });

  it("rejects unsafe paths", () => {
    expect(resolveWorkerHttpPath(BASE, "../etc/passwd")).toEqual({ error: "无效路径" });
  });
});

describe("normalizeWorkerBaseUrl", () => {
  it("adds https scheme and strips path", () => {
    expect(normalizeWorkerBaseUrl("api.example.com")).toEqual({ url: "https://api.example.com" });
    expect(normalizeWorkerBaseUrl("http://127.0.0.1:8788")).toEqual({ url: "http://127.0.0.1:8788" });
  });

  it("rejects empty host", () => {
    expect(normalizeWorkerBaseUrl("  ")).toEqual({ error: "Host 不能为空" });
  });
});

describe("normalizeWorkerPath", () => {
  it("accepts valid paths", () => {
    expect(normalizeWorkerPath("/health")).toBe("/health");
    expect(normalizeWorkerPath("/v1/responses")).toBe("/v1/responses");
  });

  it("rejects unsafe paths", () => {
    expect(normalizeWorkerPath("../etc/passwd")).toBeNull();
    expect(normalizeWorkerPath("https://evil.test/x")).toBeNull();
    expect(normalizeWorkerPath("v1/responses")).toBe("/v1/responses");
  });
});

describe("parseWorkerHttpMethod", () => {
  it("defaults to POST", () => {
    expect(parseWorkerHttpMethod(undefined)).toBe("POST");
    expect(parseWorkerHttpMethod("get")).toBe("GET");
    expect(parseWorkerHttpMethod("TRACE")).toBeNull();
  });
});

describe("workerPathNeedsAuth", () => {
  it("skips only /health", () => {
    expect(workerPathNeedsAuth("/health")).toBe(false);
    expect(workerPathNeedsAuth("/v1/responses")).toBe(true);
  });
});
