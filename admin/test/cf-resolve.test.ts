import { describe, it, expect } from "vitest";
import {
  pickDefaultGateway,
  pickDefaultProvider,
  RESPONSES_API_PATH,
} from "../src/cf-resolve";

describe("cf-resolve", () => {
  it("pickDefaultGateway prefers is_default", () => {
    const g = pickDefaultGateway([
      { id: "gw-a" },
      { id: "gw-b", is_default: true },
    ]);
    expect(g?.id).toBe("gw-b");
  });

  it("pickDefaultGateway skips builtin default when possible", () => {
    const g = pickDefaultGateway([{ id: "default" }, { id: "qwen-gw" }]);
    expect(g?.id).toBe("qwen-gw");
  });

  it("pickDefaultProvider picks first enabled slug", () => {
    const p = pickDefaultProvider([
      { slug: "disabled", base_url: "https://a", enable: false },
      { slug: "active", base_url: "https://b", enable: true },
    ]);
    expect(p?.slug).toBe("active");
  });

  it("RESPONSES_API_PATH is fixed", () => {
    expect(RESPONSES_API_PATH).toBe("/responses");
  });
});
