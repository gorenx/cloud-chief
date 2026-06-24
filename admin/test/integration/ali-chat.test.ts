import { describe, expect, it } from "vitest";
import { createDashScopeClient, defaultModel, hasDashScopeKey } from "./helpers";

/**
 * 阿里云 Chat Completions（OpenAI 兼容）
 * @see ai-gateway-worker/ali-llm-api/chat-api/api.md
 */
describe.skipIf(!hasDashScopeKey())("ali Chat Completions · OpenAI TS SDK", () => {
  const model = defaultModel();
  const prompt = "用一句话介绍你自己。";

  it("非流式：返回 assistant 正文", async () => {
    const client = createDashScopeClient();
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
    });

    const text = completion.choices[0]?.message?.content?.trim();
    expect(completion.object).toBe("chat.completion");
    expect(text).toBeTruthy();
    expect(completion.usage?.total_tokens).toBeGreaterThan(0);
  }, 60_000);

  it("流式：choices[0].delta.content 增量拼接", async () => {
    const client = createDashScopeClient();
    const stream = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    });

    let acc = "";
    for await (const chunk of stream) {
      expect(chunk.object).toBe("chat.completion.chunk");
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) acc += delta;
    }

    expect(acc.trim().length).toBeGreaterThan(0);
  }, 60_000);
});
