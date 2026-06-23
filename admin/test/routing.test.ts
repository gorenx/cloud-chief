import { describe, it, expect } from "vitest";
import { buildWorkerRouting } from "../src/routing";

describe("buildWorkerRouting", () => {
  it("builds invoke_url from wrangler vars and matches CF provider", () => {
    const r = buildWorkerRouting([
      { slug: "qwen-beijing-maas", base_url: "https://example.maas.aliyuncs.com", enable: true },
      { slug: "other", base_url: "https://other.com", enable: true },
    ]);
    expect(r.gateway).toBe("qwen-gw");
    expect(r.provider_slug).toBe("qwen-beijing-maas");
    expect(r.provider?.base_url).toBe("https://example.maas.aliyuncs.com");
    expect(r.invoke_url).toContain("/qwen-gw/custom-qwen-beijing-maas");
    expect(r.default_model).toBeTruthy();
    expect(r.free_model).toBeTruthy();
    expect(r.plus_model).toBeTruthy();
  });
});
