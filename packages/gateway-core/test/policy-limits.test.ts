import { describe, it, expect } from "vitest";
import {
  DEVICE_DAILY_CAP,
  FREE_DAILY_CEILING,
  PolicyConfigError,
  resolveGatewayLimits,
} from "../src/policy.js";

describe("resolveGatewayLimits", () => {
  it("uses policy defaults when vars omitted", () => {
    expect(resolveGatewayLimits({})).toEqual({
      freeDailyCeiling: FREE_DAILY_CEILING,
      maxTokens: 4096,
      maxPromptChars: 100_000,
      deviceDailyCap: DEVICE_DAILY_CAP,
      ipDailyCap: 64,
    });
  });

  it("parses wrangler string vars", () => {
    expect(
      resolveGatewayLimits({
        FREE_DAILY_CEILING: "12",
        DEVICE_DAILY_CAP: "20",
      }).freeDailyCeiling,
    ).toBe(12);
  });

  it("rejects out-of-range values", () => {
    expect(() =>
      resolveGatewayLimits({ FREE_DAILY_CEILING: "101" }),
    ).toThrow(PolicyConfigError);
  });
});
