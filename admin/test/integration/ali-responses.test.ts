import { describe, expect, it } from "vitest";
import { createDashScopeClient, defaultModel, hasDashScopeKey } from "./helpers";

/**
 * 阿里云 Responses API（OpenAI 兼容）
 */
describe.skipIf(!hasDashScopeKey())("ali Responses API · OpenAI TS SDK", () => {
  const model = defaultModel();
  const prompt = "用一句话介绍人工智能。";

  it("流式：response.output_text.delta 增量拼接", async () => {
    const client = createDashScopeClient();
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

  it("非流式：output_text 可用（HTTP/1.1 下可能不稳定）", async () => {
    const client = createDashScopeClient();
    const response = await client.responses.create({
      model,
      input: prompt,
    });

    expect(response.object).toBe("response");
    expect(response.output_text?.trim().length).toBeGreaterThan(0);
    expect(response.usage?.total_tokens).toBeGreaterThan(0);
  }, 90_000);
});
