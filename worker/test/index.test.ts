import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const BASE = "https://proxy.test";

describe("ai-gateway-proxy", () => {
  it("GET /health returns ok", async () => {
    const res = await SELF.fetch(`${BASE}/health`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("rejects /v1/responses without bearer token", async () => {
    const res = await SELF.fetch(`${BASE}/v1/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "qwen3-max", input: [] }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/missing bearer token/);
  });

  it("rejects a malformed bearer token with 401", async () => {
    const res = await SELF.fetch(`${BASE}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer not-a-real-jwt",
      },
      body: JSON.stringify({ model: "qwen3-max", messages: [] }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/invalid token/);
  });

  it("returns 404 for unknown path", async () => {
    const res = await SELF.fetch(`${BASE}/nope`, { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("guards /v1/* before routing (unknown /v1 path still needs auth)", async () => {
    const res = await SELF.fetch(`${BASE}/v1/unknown`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("CORS preflight is allowed", async () => {
    const res = await SELF.fetch(`${BASE}/v1/responses`, {
      method: "OPTIONS",
      headers: {
        origin: "https://app.example.com",
        "access-control-request-method": "POST",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });
});
