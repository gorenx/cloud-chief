import type { Context } from "hono";
import {
  affectsPlus,
  createAdminClient,
  fallbackEventState,
  fetchRevenueCatEntitlement,
  isUuid,
  mirrorEntitlementFromRest,
  numberField,
  uuidArrayField,
  WEBHOOK_FALLBACK_GRANT,
  WEBHOOK_FALLBACK_IGNORE,
  WEBHOOK_FALLBACK_REVOKE,
  writeWebhookEntitlement,
} from "@cloud-chief/gateway-core";
import type { Env } from "./types";

export async function handleRevenueCatWebhook(c: Context<{ Bindings: Env }>) {
  if (c.req.method !== "POST") {
    return c.text("method_not_allowed", 405);
  }
  const env = c.env;
  if (
    !env.REVENUECAT_WEBHOOK_SECRET ||
    !env.SUPABASE_URL ||
    !env.SUPABASE_SERVICE_ROLE_KEY ||
    c.req.header("Authorization") !== `Bearer ${env.REVENUECAT_WEBHOOK_SECRET}`
  ) {
    return c.text("unauthorized", 401);
  }

  let body: { event?: Record<string, unknown> };
  try {
    body = await c.req.json();
  } catch {
    return c.text("bad_json", 400);
  }

  const ev = body?.event ?? {};
  const type = String(ev.type ?? "");
  const eventId = typeof ev.id === "string" ? ev.id : null;
  const eventAtMs = numberField(ev, "event_timestamp_ms");
  if (eventAtMs === null) {
    return c.text("bad_event_time", 400);
  }

  const admin = createAdminClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  if (type === "TRANSFER") {
    const ids = [
      ...uuidArrayField(ev, "transferred_from"),
      ...uuidArrayField(ev, "transferred_to"),
    ];
    if (ids.length === 0) return c.text("ignored_transfer", 200);
    if (!env.REVENUECAT_REST_API_KEY) {
      return c.text("transfer_requires_rest_api", 500);
    }
    for (const userId of new Set(ids)) {
      let state;
      try {
        state = await fetchRevenueCatEntitlement(userId, env.REVENUECAT_REST_API_KEY);
      } catch {
        return c.text("revenuecat_read_failed", 500);
      }
      const response = await writeWebhookEntitlement(
        admin,
        userId,
        state,
        eventId,
        eventAtMs,
      );
      if (response && response.status !== 200) return response;
    }
    return c.text("ok", 200);
  }

  const appUserId = String(ev.app_user_id ?? "");
  if (!isUuid(appUserId)) return c.text("ignored_non_uuid_user", 200);
  if (!affectsPlus(ev)) return c.text("ignored_other_entitlement", 200);

  let state;
  try {
    state = env.REVENUECAT_REST_API_KEY
      ? await fetchRevenueCatEntitlement(appUserId, env.REVENUECAT_REST_API_KEY)
      : fallbackEventState(
        ev,
        WEBHOOK_FALLBACK_GRANT,
        WEBHOOK_FALLBACK_REVOKE,
        WEBHOOK_FALLBACK_IGNORE,
      );
  } catch {
    return c.text("revenuecat_read_failed", 500);
  }
  if (state === null) return c.text("ignored_event", 200);

  const response = await writeWebhookEntitlement(
    admin,
    appUserId,
    state,
    eventId,
    eventAtMs,
  );
  if (response) return response;
  return c.text("ok", 200);
}

export async function handleSyncEntitlement(c: Context<{ Bindings: Env; Variables: { claims: { sub?: string } } }>) {
  const env = c.env;
  if (
    !env.REVENUECAT_REST_API_KEY ||
    !env.SUPABASE_URL ||
    !env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return c.json({ error: "sync_misconfigured" }, 500);
  }

  const userId = c.get("claims").sub;
  if (!userId) {
    return c.json({ error: "token missing sub claim" }, 403);
  }

  let state;
  try {
    state = await fetchRevenueCatEntitlement(userId, env.REVENUECAT_REST_API_KEY);
  } catch {
    return c.json({ error: "revenuecat_read_failed" }, 502);
  }

  const admin = createAdminClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const writeErr = await mirrorEntitlementFromRest(admin, userId, state);
  if (writeErr) return c.json({ error: writeErr }, 500);

  return c.json({
    is_plus: state.isPlus,
    expires_at: state.expiresAt,
    product_id: state.productId,
  });
}
