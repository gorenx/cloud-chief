// RevenueCat → user_entitlements mirror. Shared by revenuecat-webhook (passive
// notifications) and sync-entitlement (client-triggered reconciliation).

import type { SupabaseClient } from "@supabase/supabase-js";
import { PLUS_ENTITLEMENT_ID } from "./policy.js";

export const REVENUECAT_SUBSCRIBERS_URL =
  "https://api.revenuecat.com/v1/subscribers";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EntitlementState = {
  isPlus: boolean;
  productId: string | null;
  expiresAt: string | null;
};

export function numberField(
  ev: Record<string, unknown>,
  key: string,
): number | null {
  const value = ev[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function stringArrayField(
  ev: Record<string, unknown>,
  key: string,
): string[] {
  const value = ev[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function uuidArrayField(
  ev: Record<string, unknown>,
  key: string,
): string[] {
  return stringArrayField(ev, key).filter((id) => UUID.test(id));
}

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

export function affectsPlus(ev: Record<string, unknown>): boolean {
  const entitlementIds = stringArrayField(ev, "entitlement_ids");
  const entitlementId = typeof ev.entitlement_id === "string"
    ? ev.entitlement_id
    : null;
  if (entitlementIds.length > 0) {
    return entitlementIds.includes(PLUS_ENTITLEMENT_ID);
  }
  if (entitlementId !== null) return entitlementId === PLUS_ENTITLEMENT_ID;
  return true;
}

export async function fetchRevenueCatEntitlement(
  userId: string,
  restApiKey: string,
): Promise<EntitlementState> {
  const res = await fetch(
    `${REVENUECAT_SUBSCRIBERS_URL}/${encodeURIComponent(userId)}`,
    {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${restApiKey}`,
      },
    },
  );
  if (!res.ok) {
    throw new Error(`revenuecat_subscriber_failed:${res.status}`);
  }
  const data = await res.json() as {
    request_date_ms?: unknown;
    subscriber?: {
      entitlements?: Record<string, {
        expires_date?: unknown;
        product_identifier?: unknown;
      }>;
    };
  };
  const nowMs = typeof data.request_date_ms === "number"
    ? data.request_date_ms
    : Date.now();
  const ent = data.subscriber?.entitlements?.[PLUS_ENTITLEMENT_ID];
  if (!ent) return { isPlus: false, productId: null, expiresAt: null };

  const expiresAt = typeof ent.expires_date === "string"
    ? ent.expires_date
    : null;
  const productId = typeof ent.product_identifier === "string"
    ? ent.product_identifier
    : null;
  if (expiresAt === null) return { isPlus: true, productId, expiresAt };

  const expiresMs = Date.parse(expiresAt);
  return {
    isPlus: Number.isFinite(expiresMs) && expiresMs > nowMs,
    productId,
    expiresAt,
  };
}

/** Client-initiated reconciliation — REST truth always wins, no event dedup. */
export async function mirrorEntitlementFromRest(
  admin: SupabaseClient,
  userId: string,
  state: EntitlementState,
): Promise<string | null> {
  const syncedAtMs = Date.now();
  const { error } = await admin.from("user_entitlements").upsert({
    user_id: userId,
    is_plus: state.isPlus,
    product_id: state.productId,
    expires_at: state.expiresAt,
    last_event_at_ms: syncedAtMs,
    last_event_id: `client_sync:${syncedAtMs}`,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) return "write_failed";
  return null;
}

/** Webhook path — dedupe by event id and ignore stale/out-of-order events. */
export async function writeWebhookEntitlement(
  admin: SupabaseClient,
  userId: string,
  state: EntitlementState,
  eventId: string | null,
  eventAtMs: number,
): Promise<Response | null> {
  const { data: current, error: readError } = await admin
    .from("user_entitlements")
    .select("last_event_at_ms, last_event_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) return new Response("read_failed", { status: 500 });
  if (
    current?.last_event_id &&
    eventId &&
    current.last_event_id === eventId
  ) {
    return new Response("duplicate_event", { status: 200 });
  }
  if (
    typeof current?.last_event_at_ms === "number" &&
    eventAtMs < current.last_event_at_ms
  ) {
    return new Response("stale_event", { status: 200 });
  }

  const { error } = await admin.from("user_entitlements").upsert({
    user_id: userId,
    is_plus: state.isPlus,
    product_id: state.productId,
    expires_at: state.expiresAt,
    last_event_at_ms: eventAtMs,
    last_event_id: eventId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) return new Response("write_failed", { status: 500 });
  return null;
}

// Fallback when REVENUECAT_REST_API_KEY is absent (dev only).
export function fallbackEventState(
  ev: Record<string, unknown>,
  grant: ReadonlySet<string>,
  revoke: ReadonlySet<string>,
  ignore: ReadonlySet<string>,
): EntitlementState | null {
  const type = String(ev.type ?? "");
  if (grant.has(type)) {
    const expMs = numberField(ev, "expiration_at_ms");
    return {
      isPlus: true,
      productId: typeof ev.product_id === "string" ? ev.product_id : null,
      expiresAt: expMs ? new Date(expMs).toISOString() : null,
    };
  }
  if (revoke.has(type)) {
    const expMs = numberField(ev, "expiration_at_ms");
    return {
      isPlus: false,
      productId: typeof ev.product_id === "string" ? ev.product_id : null,
      expiresAt: expMs ? new Date(expMs).toISOString() : null,
    };
  }
  if (ignore.has(type)) return null;
  return null;
}
