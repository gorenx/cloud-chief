import { describe, expect, it } from "vitest";
import {
  buildWorkerEndpointOptions,
  customEndpointId,
  parseWorkerEndpoint,
  pickEndpointUrl,
  WORKER_ENDPOINT_LOCAL,
  WORKER_ENDPOINT_WORKERS_DEV,
} from "../src/worker-endpoints";

describe("worker-endpoints", () => {
  it("parseWorkerEndpoint maps legacy online to workers_dev", () => {
    expect(parseWorkerEndpoint("online")).toBe(WORKER_ENDPOINT_WORKERS_DEV);
    expect(parseWorkerEndpoint("local")).toBe(WORKER_ENDPOINT_LOCAL);
    expect(parseWorkerEndpoint("custom:api.example.com")).toBe("custom:api.example.com");
  });

  it("buildWorkerEndpointOptions includes local, workers.dev and custom domains", () => {
    const endpoints = buildWorkerEndpointOptions(
      "http://127.0.0.1:8788",
      "https://ai-gateway-proxy.sub.workers.dev",
      ["api.example.com", "api.example.com"],
    );
    expect(endpoints.map((e) => e.id)).toEqual([
      WORKER_ENDPOINT_LOCAL,
      WORKER_ENDPOINT_WORKERS_DEV,
      customEndpointId("api.example.com"),
    ]);
    expect(endpoints[2]?.url).toBe("https://api.example.com");
  });

  it("pickEndpointUrl resolves custom domain", () => {
    const endpoints = buildWorkerEndpointOptions(
      "http://127.0.0.1:8789",
      null,
      ["rc.example.com"],
    );
    expect(
      pickEndpointUrl(endpoints, "http://127.0.0.1:8789", "custom:rc.example.com"),
    ).toEqual({ url: "https://rc.example.com" });
  });
});
