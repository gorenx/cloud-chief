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
  it("GET /config returns model + gateway id + gateways list + models", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("custom-providers")) {
        return new Response(
          JSON.stringify({
            success: true,
            result: [{ slug: "test-slug", base_url: "https://example.com", enable: true }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ success: true, result: [{ id: "gw-a" }, { id: "gw-b" }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    try {
      const res = await app.request("/config");
      expect(res.status).toBe(200);
      const j = (await res.json()) as {
        model: string;
        gateway: string;
        gateways: string[];
        models: unknown[];
        routing: { invoke_url: string; path: string; provider_slug: string };
        routing_preview: string;
        base_url: string;
        path: string;
        _meta: { fields: Record<string, { source: string; key?: string }> };
      };
      expect(j.model).toBeTruthy();
      expect(j.gateway).toBeTruthy();
      expect(Array.isArray(j.gateways)).toBe(true);
      expect(j.gateways).toContain(j.gateway);
      expect(j.gateways).toContain("gw-a");
      expect(Array.isArray(j.models)).toBe(true);
      expect(j.models.length).toBeGreaterThan(0);
      expect(typeof j.routing_preview).toBe("string");
      expect(j.routing.invoke_url).toBe(j.routing_preview);
      expect(typeof j.routing.path).toBe("string");
      expect(j._meta.fields.gateway.source).toBe("cf");
      expect(j._meta.fields.model.source).toBe("catalog");
      expect(j._meta.fields["routing.invoke_url"].source).toBe("derived");
      expect(j._meta.fields["routing.provider_slug"].source).toBe("cf");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe("gateway context", () => {
  it("GET /admin/gateways/:id/context requires auth", async () => {
    const res = await app.request("/admin/gateways/test-gw/context");
    expect(res.status).toBe(401);
  });

  it("GET /admin/gateways/:id/context returns routing + model_meta", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/gateways/test-gw") && !url.includes("provider_configs")) {
        return new Response(
          JSON.stringify({
            success: true,
            result: { id: "test-gw", authentication: true, collect_logs: true },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("custom-providers")) {
        return new Response(
          JSON.stringify({
            success: true,
            result: [{ slug: "test-slug", base_url: "https://example.com", enable: true }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("provider_configs")) {
        return new Response(JSON.stringify({ success: true, result: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: false }), { status: 404 });
    }) as typeof fetch;
    try {
      const res = await app.request("/admin/gateways/test-gw/context", {
        headers: { authorization: "Bearer test-token" },
      });
      expect(res.status).toBe(200);
      const j = (await res.json()) as {
        routing: { model: string; invoke_url: string; api_type: string };
        model_meta: { id: string } | null;
        _meta: { fields: Record<string, { source: string }> };
      };
      expect(j.routing.model).toBeTruthy();
      expect(j.routing.api_type).toBe("responses");
      expect(j.routing.invoke_url).toContain("test-gw");
      expect(j.routing.invoke_url).toContain("custom-test-slug");
      expect(j._meta.fields.keys.source).toBe("cf");
      expect(j._meta.fields["routing.provider_slug"].source).toBe("cf");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe("spa static", () => {
  it("GET / serves web/dist index.html when built", async () => {
    const res = await app.request("/");
    if (res.status === 200) {
      const text = await res.text();
      expect(text.includes("root") || text.includes("Qwen")).toBe(true);
    }
  });
});

describe("health", () => {
  it("GET /health returns ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok: boolean };
    expect(j.ok).toBe(true);
  });
});
