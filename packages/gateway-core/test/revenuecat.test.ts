import { describe, it, expect } from "vitest";
import {
  affectsPlus,
  fallbackEventState,
  isUuid,
  WEBHOOK_FALLBACK_GRANT,
  WEBHOOK_FALLBACK_IGNORE,
  WEBHOOK_FALLBACK_REVOKE,
} from "../src/revenuecat-entitlement.js";
import { utcPeriodKey } from "../src/ai-gateway/index.js";

describe("revenuecat-entitlement", () => {
  it("isUuid accepts canonical uuids", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
  });

  it("affectsPlus filters by entitlement id", () => {
    const plusId = "wren Pro";
    expect(affectsPlus({ entitlement_ids: [plusId] }, plusId)).toBe(true);
    expect(affectsPlus({ entitlement_ids: ["other"] }, plusId)).toBe(false);
  });

  it("fallbackEventState maps grant and revoke types", () => {
    const grant = fallbackEventState(
      { type: "INITIAL_PURCHASE", product_id: "monthly" },
      WEBHOOK_FALLBACK_GRANT,
      WEBHOOK_FALLBACK_REVOKE,
      WEBHOOK_FALLBACK_IGNORE,
    );
    expect(grant?.isPlus).toBe(true);

    const ignore = fallbackEventState(
      { type: "TEST" },
      WEBHOOK_FALLBACK_GRANT,
      WEBHOOK_FALLBACK_REVOKE,
      WEBHOOK_FALLBACK_IGNORE,
    );
    expect(ignore).toBeNull();
  });
});

describe("ai-gateway", () => {
  it("utcPeriodKey uses UTC calendar day", () => {
    expect(utcPeriodKey(new Date("2026-06-19T23:59:00Z"))).toBe("2026-06-19");
  });
});
