import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  AiGatewayError,
  bumpThrottle,
  consumeAiCredit,
  peekThrottle,
} from "./ai_gateway.js";

// Validation-only specs — quota/throttle concurrency is covered by integration
// tests against a live stack (see supabase/tests/ai_gateway_test.sql for RLS).

Deno.test("consumeAiCredit rejects malformed period", async () => {
  const admin = {} as never;
  await assertRejects(
    () => consumeAiCredit(admin, "11111111-1111-1111-1111-111111111111", "bad", 3),
    AiGatewayError,
    "invalid period_key",
  );
});

Deno.test("consumeAiCredit rejects invalid quota", async () => {
  const admin = {} as never;
  await assertRejects(
    () => consumeAiCredit(admin, "11111111-1111-1111-1111-111111111111", "2026-06-12", 0),
    AiGatewayError,
    "invalid quota",
  );
});

Deno.test("consumeAiCredit rejects long device id", async () => {
  const admin = {} as never;
  await assertRejects(
    () =>
      consumeAiCredit(
        admin,
        "11111111-1111-1111-1111-111111111111",
        "2026-06-12",
        3,
        "x".repeat(81),
      ),
    AiGatewayError,
    "invalid device_id",
  );
});

Deno.test("consumeAiCredit returns refused for null user id", async () => {
  const admin = {} as never;
  const result = await consumeAiCredit(admin, "", "2026-06-12", 3);
  assertEquals(result, { granted: false, used: 0, quota: 3 });
});

Deno.test("peekThrottle empty bucket always allows", async () => {
  const admin = {} as never;
  const ok = await peekThrottle(admin, "device", "", "2026-06-12", 1);
  assertEquals(ok, true);
});

Deno.test("bumpThrottle empty bucket always allows", async () => {
  const admin = {} as never;
  const ok = await bumpThrottle(admin, "device", "", "2026-06-12", 1);
  assertEquals(ok, true);
});

Deno.test("bumpThrottle rejects unknown scope", async () => {
  const admin = {} as never;
  await assertRejects(
    () => bumpThrottle(admin, "email", "d1", "2026-06-12", 2),
    AiGatewayError,
    "invalid throttle scope",
  );
});
