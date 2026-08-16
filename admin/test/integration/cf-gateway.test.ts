import { describe, expect, it } from "vitest";
import { gatewayCompatibleBaseUrl } from "../../src/openai-llm";
import {
  createGatewayTestClient,
  defaultModel,
  gatewayConfig,
  gatewayFullUrl,
  hasGatewayConfig,
} from "./helpers";

/**
 * 经 Cloudflare AI Gateway 调用百炼（与 admin openai-llm / worker gateway.ts 相同上游）
 */
describe.skipIf(!hasGatewayConfig())("CF AI Gateway · OpenAI TS SDK", () => {
  const model = defaultModel();
  const prompt = "回复 OK 两个字母即可。";

  it("gatewayCompatibleBaseUrl 与完整路径约定一致", () => {
    const cfg = gatewayConfig();
    const base = gatewayCompatibleBaseUrl(cfg.accountId, cfg.gatewayId, cfg.providerSlug);
    expect(gatewayFullUrl("chat")).toBe(`${base}/chat/completions`);
    expect(gatewayFullUrl("responses")).toBe(`${base}/responses`);
    expect(base).toMatch(/\/custom-[^/]+$/);
  });

  it("Chat Completions 经网关非流式", async () => {
    const client = createGatewayTestClient("chat");
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
    });

    expect(completion.choices[0]?.message?.content?.trim().length).toBeGreaterThan(0);
  }, 90_000);

  it("Responses 经网关流式", async () => {
    const client = createGatewayTestClient("responses");
    const stream = await client.responses.create({
      model,
      input: prompt,
      stream: true,
    });

    let acc = "";
    for await (const event of stream) {
      if (event.type === "response.output_text.delta") acc += event.delta;
    }
    expect(acc.trim().length).toBeGreaterThan(0);
  }, 90_000);
});
