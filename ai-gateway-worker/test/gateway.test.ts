import { describe, expect, it } from "vitest";
import { gatewayUrl } from "../src/gateway";
import type { Env } from "../src/types";

const env: Env = {
  CF_ACCOUNT_ID: "acct",
  CF_GATEWAY_ID: "gw",
  PROVIDER_SLUG: "provider",
  DEFAULT_MODEL: "qwen-plus",
  SUPABASE_URL: "https://example.supabase.co",
  DASHSCOPE_API_KEY: "sk-test",
  SUPABASE_SERVICE_ROLE_KEY: "srk",
};

describe("gateway", () => {
  it("gatewayUrl 指向 CF AI Gateway 百炼兼容路径", () => {
    expect(gatewayUrl(env, "chat")).toBe(
      "https://gateway.ai.cloudflare.com/v1/acct/gw/custom-provider/compatible-mode/v1/chat/completions",
    );
    expect(gatewayUrl(env, "responses")).toBe(
      "https://gateway.ai.cloudflare.com/v1/acct/gw/custom-provider/compatible-mode/v1/responses",
    );
  });
});
