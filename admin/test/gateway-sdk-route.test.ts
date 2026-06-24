import { describe, expect, it } from "vitest";
import { resolveGatewaySdkRoute } from "../src/openai-llm";

describe("resolveGatewaySdkRoute", () => {
  const accountId = "acct";
  const gatewayId = "gw";
  const slug = "my-prov";

  it("maps default chat path", () => {
    const r = resolveGatewaySdkRoute(accountId, gatewayId, slug, "/chat/completions");
    expect(r).toEqual({
      kind: "chat",
      baseURL: "https://gateway.ai.cloudflare.com/v1/acct/gw/custom-my-prov",
    });
  });

  it("maps default responses path", () => {
    const r = resolveGatewaySdkRoute(accountId, gatewayId, slug, "/responses");
    expect(r).toEqual({
      kind: "responses",
      baseURL: "https://gateway.ai.cloudflare.com/v1/acct/gw/custom-my-prov",
    });
  });

  it("keeps compatible-mode prefix in SDK baseURL", () => {
    const r = resolveGatewaySdkRoute(
      accountId,
      gatewayId,
      slug,
      "/compatible-mode/v1/responses",
    );
    expect(r).toEqual({
      kind: "responses",
      baseURL:
        "https://gateway.ai.cloudflare.com/v1/acct/gw/custom-my-prov/compatible-mode/v1",
    });
  });

  it("falls back to raw fetch for unknown suffix", () => {
    const r = resolveGatewaySdkRoute(accountId, gatewayId, slug, "/embeddings");
    expect(r).toEqual({
      kind: "raw",
      url: "https://gateway.ai.cloudflare.com/v1/acct/gw/custom-my-prov/embeddings",
    });
  });
});
