import { describe, it, expect } from "vitest";
import { parseEnvFileContent } from "../src/env";

describe("parseEnvFileContent", () => {
  it("parses key=value and strips quotes", () => {
    const m = parseEnvFileContent(`
# comment
ADMIN_TOKEN=abc
MODEL="qwen-plus"
PORT=9000
`);
    expect(m.ADMIN_TOKEN).toBe("abc");
    expect(m.MODEL).toBe("qwen-plus");
    expect(m.PORT).toBe("9000");
  });

  it("allows empty values", () => {
    expect(parseEnvFileContent("ADMIN_TOKEN=\n")).toEqual({ ADMIN_TOKEN: "" });
  });

  it("ignores invalid lines", () => {
    expect(parseEnvFileContent("not-env\nCF_ACCOUNT_ID=x")).toEqual({ CF_ACCOUNT_ID: "x" });
  });
});
