import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { affectsPlus, isUuid } from "./revenuecat_entitlement.js";
import { PLUS_ENTITLEMENT_ID } from "./policy.js";

Deno.test("isUuid accepts canonical uids", () => {
  assertEquals(isUuid("11111111-1111-1111-1111-111111111111"), true);
  assertEquals(isUuid("not-a-uuid"), false);
});

Deno.test("affectsPlus filters non-Pro entitlements", () => {
  assertEquals(affectsPlus({ entitlement_ids: [PLUS_ENTITLEMENT_ID] }), true);
  assertEquals(affectsPlus({ entitlement_ids: ["other"] }), false);
});
