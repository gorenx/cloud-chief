import { describe, it, expect } from "vitest";
import { app } from "../src/app";
import { secretSet, gatewayUpsert, devVarsUpdate } from "../src/schemas";

const TOKEN = "test-token";
const authed = { "content-type": "application/json", authorization: `Bearer ${TOKEN}` };

describe("admin auth", () => {
  it("GET /admin/state without token -> 401", async () => {
    const res = await app.request("/admin/state");
    expect(res.status).toBe(401);
  });

  it("GET /admin/state with wrong token -> 401", async () => {
    const res = await app.request("/admin/state", {
      headers: { authorization: "Bearer nope" },
    });
    expect(res.status).toBe(401);
  });

  it("worker route is also guarded", async () => {
    const res = await app.request("/admin/worker/status");
    expect(res.status).toBe(401);
  });
});

describe("validation", () => {
  it("POST /admin/gateways with empty body -> 400", async () => {
    const res = await app.request("/admin/gateways", {
      method: "POST",
      headers: authed,
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const j = (await res.json()) as { error: string };
    expect(j.error).toMatch(/id/);
  });

  it("POST /admin/worker/secret with non-whitelisted name -> 400", async () => {
    const res = await app.request("/admin/worker/secret", {
      method: "POST",
      headers: authed,
      body: JSON.stringify({ name: "EVIL_NAME", value: "x" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("schemas", () => {
  it("secretSet validates name as an env identifier", () => {
    expect(secretSet.safeParse({ name: "bad name", value: "x" }).success).toBe(false);
    expect(secretSet.safeParse({ name: "lower", value: "x" }).success).toBe(false);
    expect(secretSet.safeParse({ name: "1ABC", value: "x" }).success).toBe(false);
    expect(secretSet.safeParse({ name: "CF_AIG_TOKEN", value: "x" }).success).toBe(true);
    expect(secretSet.safeParse({ name: "CF_AIG_TOKEN", value: "" }).success).toBe(false);
  });

  it("devVarsUpdate validates secret names and requires at least one", () => {
    expect(devVarsUpdate.safeParse({ secrets: {} }).success).toBe(false);
    expect(devVarsUpdate.safeParse({ secrets: { bad: "x" } }).success).toBe(false);
    expect(devVarsUpdate.safeParse({ secrets: { CF_AIG_TOKEN: "x" } }).success).toBe(true);
    expect(devVarsUpdate.safeParse({ secrets: { CF_AIG_TOKEN: "" } }).success).toBe(true);
  });

  it("gatewayUpsert requires id", () => {
    expect(gatewayUpsert.safeParse({}).success).toBe(false);
    expect(gatewayUpsert.safeParse({ id: "gw" }).success).toBe(true);
  });
});

describe("public config", () => {
  it("GET /config returns model + gateway id + gateways list", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ success: true, result: [{ id: "gw-a" }, { id: "gw-b" }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as typeof fetch;
    try {
      const res = await app.request("/config");
      expect(res.status).toBe(200);
      const j = (await res.json()) as {
        model: string;
        gateway: string;
        gateways: string[];
      };
      expect(j.model).toBeTruthy();
      expect(j.gateway).toBeTruthy();
      expect(Array.isArray(j.gateways)).toBe(true);
      expect(j.gateways).toContain(j.gateway);
      expect(j.gateways).toContain("gw-a");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
