import { describe, expect, it } from "vitest";
import { buildResponsesCreateParams } from "../src/openai-llm";

describe("buildResponsesCreateParams", () => {
  it("first turn uses latest user text only", () => {
    expect(
      buildResponsesCreateParams([{ role: "user", content: "你好" }]),
    ).toEqual({ input: "你好" });
  });

  it("follow-up uses previous_response_id and only new user input", () => {
    expect(
      buildResponsesCreateParams(
        [
          { role: "user", content: "第一轮" },
          { role: "assistant", content: "回复一" },
          { role: "user", content: "第二轮" },
        ],
        "resp_abc",
      ),
    ).toEqual({
      input: "第二轮",
      previous_response_id: "resp_abc",
    });
  });
});
