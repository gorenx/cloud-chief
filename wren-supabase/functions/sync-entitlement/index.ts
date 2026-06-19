// sync-entitlement — client-triggered Plus reconciliation.
//
// When a webhook is lost, the app's RevenueCat SDK may already show Plus while
// user_entitlements (read by wren-voice) is stale. An authenticated client
// calls this after login / purchase / restore; the server pulls RevenueCat REST
// truth for the JWT user and upserts user_entitlements. The client never claims
// Plus — only asks the server to mirror RC.

import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.js";
import {
  fetchRevenueCatEntitlement,
  mirrorEntitlementFromRest,
} from "../_shared/revenuecat_entitlement.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const REVENUECAT_REST_API_KEY = Deno.env.get("REVENUECAT_REST_API_KEY") ?? "";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (
    !REVENUECAT_REST_API_KEY ||
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    !SERVICE_ROLE
  ) {
    return json(500, { error: "sync_misconfigured" });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) return json(401, { error: "unauthorized" });

  let state;
  try {
    state = await fetchRevenueCatEntitlement(user.id, REVENUECAT_REST_API_KEY);
  } catch (_e) {
    return json(502, { error: "revenuecat_read_failed" });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });
  const writeErr = await mirrorEntitlementFromRest(admin, user.id, state);
  if (writeErr) return json(500, { error: writeErr });

  return json(200, {
    is_plus: state.isPlus,
    expires_at: state.expiresAt,
    product_id: state.productId,
  });
});
