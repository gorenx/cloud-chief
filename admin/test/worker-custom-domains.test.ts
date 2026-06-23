import { describe, expect, it } from "vitest";
import { listWorkerCustomDomains, parseBindings } from "../src/cf-worker-resolve";

describe("listWorkerCustomDomains", () => {
  it("returns hostnames from CF domains API", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/workers/domains?service=ai-gateway-proxy")) {
        return new Response(
          JSON.stringify({
            success: true,
            result: [
              { hostname: "api.example.com", service: "ai-gateway-proxy" },
              { hostname: "gw.example.com", service: "ai-gateway-proxy" },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ success: true, result: [] }), {
        status: 200,
        headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      const r = await listWorkerCustomDomains("ai-gateway-proxy", true);
      expect(r.ok).toBe(true);
      expect(r.hostnames).toEqual(["api.example.com", "gw.example.com"]);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("requires api token", async () => {
    const r = await listWorkerCustomDomains("x", false);
    expect(r.ok).toBe(false);
    expect(r.hostnames).toEqual([]);
  });
});

describe("parseBindings", () => {
  it("still extracts vars", () => {
    const r = parseBindings([{ type: "plain_text", name: "A", text: "1" }]);
    expect(r.vars.A).toBe("1");
  });
});
