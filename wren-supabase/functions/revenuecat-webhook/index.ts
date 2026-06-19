// revenuecat-webhook — makes the server the authority on Plus.
//
// RevenueCat (which has already validated the App Store / Play receipt) POSTs
// subscription events here. We verify a shared secret, map RevenueCat users
// (= Supabase uid, set via Purchases.logIn at sign-in) to the current `wren Pro`
// entitlement, and upsert user_entitlements with the service role (bypassing
// RLS — clients can never write this table). The wren-voice gateway reads only
// that table for tier.
//
// verify_jwt is OFF for this function (config.toml): RevenueCat does not carry a
// Supabase JWT, so we authenticate it ourselves via the shared secret.
//
// Lost webhooks are reconciled by sync-entitlement (client-triggered REST mirror).

import { createClient } from "@supabase/supabase-js";
import {
  affectsPlus,
  fallbackEventState,
  fetchRevenueCatEntitlement,
  isUuid,
  numberField,
  uuidArrayField,
  writeWebhookEntitlement,
} from "../_shared/revenuecat_entitlement.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("REVENUECAT_WEBHOOK_SECRET") ?? "";
const REVENUECAT_REST_API_KEY = Deno.env.get("REVENUECAT_REST_API_KEY") ?? "";

const FALLBACK_GRANT = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  "SUBSCRIPTION_EXTENDED",
  "TEMPORARY_ENTITLEMENT_GRANT",
  "REFUND_REVERSED",
]);
const FALLBACK_REVOKE = new Set(["EXPIRATION"]);
const FALLBACK_IGNORE = new Set([
  "TEST",
  "CANCELLATION",
  "BILLING_ISSUE",
  "PRODUCT_CHANGE",
  "SUBSCRIPTION_PAUSED",
]);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method_not_allowed", { status: 405 });
  }
  if (
    !WEBHOOK_SECRET ||
    !SUPABASE_URL ||
    !SERVICE_ROLE ||
    req.headers.get("Authorization") !== `Bearer ${WEBHOOK_SECRET}`
  ) {
    return new Response("unauthorized", { status: 401 });
  }

  let body: { event?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return new Response("bad_json", { status: 400 });
  }

  const ev = body?.event ?? {};
  const type = String(ev.type ?? "");
  const eventId = typeof ev.id === "string" ? ev.id : null;
  const eventAtMs = numberField(ev, "event_timestamp_ms");
  if (eventAtMs === null) {
    return new Response("bad_event_time", { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  if (type === "TRANSFER") {
    const ids = [
      ...uuidArrayField(ev, "transferred_from"),
      ...uuidArrayField(ev, "transferred_to"),
    ];
    if (ids.length === 0) {
      return new Response("ignored_transfer", { status: 200 });
    }
    if (!REVENUECAT_REST_API_KEY) {
      return new Response("transfer_requires_rest_api", { status: 500 });
    }
    for (const userId of new Set(ids)) {
      let state;
      try {
        state = await fetchRevenueCatEntitlement(
          userId,
          REVENUECAT_REST_API_KEY,
        );
      } catch (_e) {
        return new Response("revenuecat_read_failed", { status: 500 });
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
    return new Response("ok", { status: 200 });
  }

  const appUserId = String(ev.app_user_id ?? "");
  if (!isUuid(appUserId)) {
    return new Response("ignored_non_uuid_user", { status: 200 });
  }
  if (!affectsPlus(ev)) {
    return new Response("ignored_other_entitlement", { status: 200 });
  }

  let state;
  try {
    state = REVENUECAT_REST_API_KEY
      ? await fetchRevenueCatEntitlement(appUserId, REVENUECAT_REST_API_KEY)
      : fallbackEventState(ev, FALLBACK_GRANT, FALLBACK_REVOKE, FALLBACK_IGNORE);
  } catch (_e) {
    return new Response("revenuecat_read_failed", { status: 500 });
  }
  if (state === null) return new Response("ignored_event", { status: 200 });

  const response = await writeWebhookEntitlement(
    admin,
    appUserId,
    state,
    eventId,
    eventAtMs,
  );
  if (response) return response;
  return new Response("ok", { status: 200 });
});
