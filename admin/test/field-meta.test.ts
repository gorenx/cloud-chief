import { describe, it, expect } from "vitest";
import { configMeta, gatewayContextMeta, routingFieldsMeta, patchWorkerRuntimeMeta } from "../src/field-meta";

describe("field-meta", () => {
  it("configMeta marks data sources", () => {
    const m = configMeta();
    expect(m.fields.gateway.source).toBe("cf");
    expect(m.fields.model.source).toBe("env");
    expect(m.fields.models.key).toBe("MODEL_CATALOG");
    expect(m.fields.gateways.source).toBe("cf");
    expect(m.fields["routing.provider_slug"].source).toBe("cf");
    expect(m.fields["routing.path"].source).toBe("derived");
    expect(m.fields["routing.invoke_url"].source).toBe("derived");
    expect(m.fields["chat.authorization"].key).toBe("DASHSCOPE_API_KEY");
    expect(m.fields["worker.url"].key).toBe("WORKER_URL");
    expect(m.fields["worker_routing.gateway"].key).toBe("CF_GATEWAY_ID");
    expect(m.fields["routing.worker_model"].source).toBe("wrangler");
  });

  it("gatewayContextMeta marks CF gateway id", () => {
    const m = gatewayContextMeta("my-gw");
    expect(m.fields.gateway.source).toBe("cf");
    expect(m.fields.keys.source).toBe("cf");
    expect(m.fields["routing.worker_model"].source).toBe("wrangler");
  });

  it("routingFieldsMeta uses cf gateway and catalog model", () => {
    const r = routingFieldsMeta();
    expect(r.gateway.source).toBe("cf");
    expect(r["routing.model"].source).toBe("catalog");
  });

  it("patchWorkerRuntimeMeta marks CF worker url and vars", () => {
    const m = patchWorkerRuntimeMeta(configMeta(), {
      url_source: "cf",
      vars_source: "cf",
      script_name: "ai-gateway-proxy",
    });
    expect(m.fields["worker.url"].source).toBe("cf");
    expect(m.fields["worker_routing.default_model"].source).toBe("cf");
  });
});
