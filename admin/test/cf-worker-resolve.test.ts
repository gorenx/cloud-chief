import { describe, it, expect } from "vitest";
import {
  buildWorkersDevUrl,
  findCfWorkerByName,
  mergeWorkerVars,
  parseBindings,
} from "../src/cf-worker-resolve";

describe("cf-worker-resolve", () => {
  it("buildWorkersDevUrl composes workers.dev URL", () => {
    expect(buildWorkersDevUrl("ai-gateway-proxy", "my-sub", true)).toBe(
      "https://ai-gateway-proxy.my-sub.workers.dev",
    );
    expect(buildWorkersDevUrl("x", "my-sub", false)).toBeNull();
  });

  it("parseBindings extracts plain_text and secret names", () => {
    const r = parseBindings([
      { type: "plain_text", name: "SUPABASE_URL", text: "https://a.supabase.co" },
      { type: "secret_text", name: "DASHSCOPE_API_KEY" },
    ]);
    expect(r.vars.SUPABASE_URL).toBe("https://a.supabase.co");
    expect(r.secret_names).toEqual(["DASHSCOPE_API_KEY"]);
  });

  it("findCfWorkerByName locates script in list", () => {
    const scripts = [
      {
        name: "ai-gateway-proxy",
        url: null,
        subdomain_enabled: true,
        vars: {},
        secret_names: [],
        compatibility_date: null,
        usage_model: null,
      },
    ];
    expect(findCfWorkerByName(scripts, "ai-gateway-proxy")?.name).toBe("ai-gateway-proxy");
    expect(findCfWorkerByName(scripts, "missing")).toBeNull();
  });

  it("mergeWorkerVars prefers CF over wrangler", () => {
    const r = mergeWorkerVars(
      { SUPABASE_URL: "https://cf.supabase.co", DEFAULT_MODEL: "qwen3-plus" },
      { SUPABASE_URL: "https://local.supabase.co", CF_GATEWAY_ID: "qwen-gw" },
    );
    expect(r.vars.SUPABASE_URL).toBe("https://cf.supabase.co");
    expect(r.vars.CF_GATEWAY_ID).toBe("qwen-gw");
    expect(r.source).toBe("merged");
  });
});
