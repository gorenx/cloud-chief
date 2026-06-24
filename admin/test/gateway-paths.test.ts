import { describe, expect, it } from "vitest";
import {
  buildGatewayPathEntries,
  normalizeGatewayPathSuffix,
  parseGatewayCustomPaths,
  primaryGatewayPath,
  joinProviderUpstreamUrl,
} from "../src/gateway-paths";

describe("gateway-paths", () => {
  it("normalizeGatewayPathSuffix", () => {
    expect(normalizeGatewayPathSuffix("chat/completions")).toBe("/chat/completions");
    expect(normalizeGatewayPathSuffix("/responses")).toBe("/responses");
    expect(normalizeGatewayPathSuffix("  ")).toBe("");
  });

  it("parseGatewayCustomPaths dedupes", () => {
    expect(parseGatewayCustomPaths("/embeddings, /v1/foo, /embeddings")).toEqual([
      "/embeddings",
      "/v1/foo",
    ]);
  });

  it("buildGatewayPathEntries honors chat/responses suffix overrides", () => {
    const entries = buildGatewayPathEntries({
      accountId: "acct",
      gatewayId: "gw",
      providerSlug: "my-prov",
      chatSuffix: "/compatible-mode/v1/chat/completions",
      responsesSuffix: "/compatible-mode/v1/responses",
    });
    expect(entries[0].suffix).toBe("/compatible-mode/v1/chat/completions");
    expect(entries[1].suffix).toBe("/compatible-mode/v1/responses");
    expect(entries[0].invoke_url).toContain("/compatible-mode/v1/chat/completions");
  });

  it("buildGatewayPathEntries includes chat, responses, and custom", () => {
    const entries = buildGatewayPathEntries({
      accountId: "acct",
      gatewayId: "gw",
      providerSlug: "my-prov",
      providerBaseUrl: "https://example.com/compatible-mode/v1",
      customSuffixes: ["/embeddings"],
    });
    expect(entries.map((e) => e.id)).toEqual(["chat", "responses", "custom-0"]);
    expect(entries[0].invoke_url).toBe(
      "https://gateway.ai.cloudflare.com/v1/acct/gw/custom-my-prov/chat/completions",
    );
    expect(entries[1].suffix).toBe("/responses");
    expect(entries[2].suffix).toBe("/embeddings");
    expect(entries[0].upstream_preview).toBe(
      "https://example.com/compatible-mode/v1/chat/completions",
    );
  });

  it("primaryGatewayPath prefers responses", () => {
    const entries = buildGatewayPathEntries({
      accountId: "a",
      gatewayId: "g",
      providerSlug: "s",
    });
    expect(primaryGatewayPath(entries)?.id).toBe("responses");
  });

  it("joinProviderUpstreamUrl", () => {
    expect(joinProviderUpstreamUrl("https://host/", "/chat/completions")).toBe(
      "https://host/chat/completions",
    );
  });
});
