// wren-voice — the server-authoritative AI gateway.
//
// The Anthropic key lives ONLY here (a function secret). The client sends its
// Supabase JWT and an opaque prompt; the server authenticates the user, decides
// the tier model, enforces the daily quota + device/IP caps, fixes the token
// budget, and proxies to Anthropic. A tampered client can do nothing here it
// couldn't do as its own authenticated, quota-bounded self.
//
// Returns { text, tier, used, quota } on 200; 429 on over-quota/throttle (the
// client maps this to its offline fallback); 401 when unauthenticated.

import { createClient } from "@supabase/supabase-js";
import {
  AiGatewayError,
  bumpThrottle,
  consumeAiCredit,
  tryBumpThrottles,
} from "../_shared/ai_gateway.js";
import { corsHeaders } from "../_shared/cors.js";
import {
  DEVICE_DAILY_CAP,
  FREE_DAILY_CEILING,
  FREE_MODEL,
  IP_DAILY_CAP,
  MAX_PROMPT_CHARS,
  MAX_TOKENS,
  PLUS_MODEL,
} from "../_shared/policy.js";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function utcPeriodKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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
    !ANTHROPIC_API_KEY ||
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    !SERVICE_ROLE
  ) {
    return json(500, { error: "gateway_misconfigured" });
  }

  // 0) authenticate — getUser() validates the JWT; the uid drives checks below.
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) return json(401, { error: "unauthorized" });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // parse + bound the request
  let payload: { prompt?: unknown; deviceId?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "bad_json" });
  }
  const prompt = payload.prompt;
  if (
    typeof prompt !== "string" ||
    prompt.length === 0 ||
    prompt.length > MAX_PROMPT_CHARS
  ) {
    return json(400, { error: "bad_prompt" });
  }
  const deviceId = typeof payload.deviceId === "string"
    ? payload.deviceId.slice(0, 80)
    : null;
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    null;
  const period = utcPeriodKey(new Date());

  // 1) entitlement — the server's own truth, written only by the RevenueCat
  //    webhook. The client's claim is never trusted.
  const { data: ent } = await userClient
    .from("user_entitlements")
    .select("is_plus, expires_at")
    .eq("user_id", user.id)
    .maybeSingle();
  const notExpired = !ent?.expires_at ||
    new Date(ent.expires_at).getTime() > Date.now();
  const isPlus = !!ent?.is_plus && notExpired;

  let model = PLUS_MODEL;
  let used = 0;
  let quota = FREE_DAILY_CEILING;

  if (!isPlus) {
    model = FREE_MODEL;

    // 2) Sybil defense-in-depth: per-device + per-IP daily caps. All buckets are
    //    peeked first; bumps are sequential with rollback so a rejection never
    //    leaves a partial device/IP count.
    let throttleOk: boolean;
    try {
      throttleOk = await tryBumpThrottles(admin, [
        { scope: "device", bucket: deviceId ?? "", period, cap: DEVICE_DAILY_CAP },
        { scope: "ip", bucket: ip ?? "", period, cap: IP_DAILY_CAP },
      ]);
    } catch (e) {
      if (e instanceof AiGatewayError) return json(500, { error: "throttle_failed" });
      throw e;
    }
    if (!throttleOk) return json(429, { error: "throttled" });

    // 3) per-user daily ceiling — the hard cost guardrail (optimistic locking).
    //    "Spend before call" never over-serves under concurrency; the rare upstream
    //    failure after a spend costs one credit (the client shows its offline
    //    fallback) — a deliberate revenue-safe trade.
    let credit;
    try {
      credit = await consumeAiCredit(
        admin,
        user.id,
        period,
        FREE_DAILY_CEILING,
        deviceId,
      );
    } catch (e) {
      if (e instanceof AiGatewayError) return json(500, { error: "quota_failed" });
      throw e;
    }
    if (!credit.granted) {
      return json(429, {
        error: "over_quota",
        used: credit.used,
        quota: FREE_DAILY_CEILING,
      });
    }
    used = credit.used;
    quota = credit.quota;
  }

  // 4) proxy to Anthropic with the SERVER-held key, SERVER-chosen model, and a
  //    SERVER-fixed token budget.
  let ar: Response;
  try {
    ar = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (_e) {
    return json(502, { error: "upstream_unreachable" });
  }
  if (!ar.ok) return json(502, { error: "upstream_error", status: ar.status });

  const data = await ar.json();
  const text = (data.content ?? [])
    .filter((b: { type?: string }) => b?.type === "text")
    .map((b: { text?: string }) => b.text ?? "")
    .join("");

  return json(200, { text, tier: isPlus ? "plus" : "free", used, quota });
});
