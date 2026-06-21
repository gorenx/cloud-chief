import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const BASE = "https://revenuecat.test";

describe("revenuecat-proxy", () => {
  it("GET /health returns ok", async () => {
    const res = await SELF.fetch(`${BASE}/health`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("rejects /v1/me without bearer token", async () => {
    const res = await SELF.fetch(`${BASE}/v1/me`);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/missing bearer token/);
  });

  it("rejects a malformed bearer token with 401", async () => {
    const res = await SELF.fetch(`${BASE}/v1/me/subscriptions`, {
      headers: { authorization: "Bearer not-a-real-jwt" },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid token");
  });

  it("rejects /v1/metrics/overview without admin whitelist", async () => {
    const res = await SELF.fetch(`${BASE}/v1/metrics/overview`, {
      headers: { authorization: "Bearer not-a-real-jwt" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown path", async () => {
    const res = await SELF.fetch(`${BASE}/nope`);
    expect(res.status).toBe(404);
  });

  it("CORS preflight is allowed", async () => {
    const res = await SELF.fetch(`${BASE}/v1/me`, {
      method: "OPTIONS",
      headers: {
        origin: "https://app.example.com",
        "access-control-request-method": "GET",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("GET");
  });
});
