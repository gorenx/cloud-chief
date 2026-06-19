// Server-side quota + throttle for wren-voice. Lives in the Edge Function layer
// (not Postgres stored procedures) so the schema stays portable.
//
// Uses service-role Supabase client + optimistic locking on `used` for safe
// concurrent increments without over-serving past the ceiling.

/// <reference path="../types/supabase-js.d.ts" />

import type { SupabaseClient } from "@supabase/supabase-js";

const PERIOD_RE = /^\d{4}-\d{2}-\d{2}$/;
const THROTTLE_SCOPES = new Set(["device", "ip"]);
const PG_UNIQUE_VIOLATION = "23505";
const MAX_RETRIES = 8;

export type ConsumeResult = { granted: boolean; used: number; quota: number };

export class AiGatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiGatewayError";
  }
}

function assertPeriod(period: string) {
  if (!PERIOD_RE.test(period)) {
    throw new AiGatewayError("invalid period_key");
  }
}

function assertQuota(quota: number) {
  if (quota < 1 || quota > 100) {
    throw new AiGatewayError("invalid quota");
  }
}

function assertDeviceId(device: string | null | undefined) {
  if (device != null && device.length > 80) {
    throw new AiGatewayError("invalid device_id");
  }
}

function validateThrottleInputs(
  scope: string,
  bucket: string,
  period: string,
  cap: number,
) {
  if (!THROTTLE_SCOPES.has(scope)) {
    throw new AiGatewayError("invalid throttle scope");
  }
  assertPeriod(period);
  if (cap < 1 || cap > 1000) {
    throw new AiGatewayError("invalid throttle cap");
  }
  if (bucket && bucket.length > 128) {
    throw new AiGatewayError("invalid throttle bucket");
  }
}

export type ThrottleCheck = {
  scope: string;
  bucket: string;
  period: string;
  cap: number;
};

/** Read-only: would the next bump stay under cap? Empty bucket always yes. */
export async function peekThrottle(
  admin: SupabaseClient,
  scope: string,
  bucket: string,
  period: string,
  cap: number,
): Promise<boolean> {
  validateThrottleInputs(scope, bucket, period, cap);
  if (!bucket) return true;

  const { data: row, error: readErr } = await admin
    .from("ai_throttle")
    .select("used")
    .eq("scope", scope)
    .eq("bucket", bucket)
    .eq("period_key", period)
    .maybeSingle();
  if (readErr) throw readErr;
  return !row || row.used < cap;
}

/** Best-effort undo of one bump (rollback when a later bucket rejects). */
async function decrementThrottle(
  admin: SupabaseClient,
  scope: string,
  bucket: string,
  period: string,
): Promise<void> {
  if (!bucket) return;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data: row, error: readErr } = await admin
      .from("ai_throttle")
      .select("used")
      .eq("scope", scope)
      .eq("bucket", bucket)
      .eq("period_key", period)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!row || row.used <= 0) return;

    const current = row.used;
    const { data: updated, error: updErr } = await admin
      .from("ai_throttle")
      .update({
        used: current - 1,
        updated_at: new Date().toISOString(),
      })
      .eq("scope", scope)
      .eq("bucket", bucket)
      .eq("period_key", period)
      .eq("used", current)
      .select("used")
      .maybeSingle();
    if (updErr) throw updErr;
    if (updated) return;
  }
}

/**
 * Peek all throttle buckets, then bump sequentially. Nothing is incremented
 * until every bucket passes the read check; a failed bump rolls back earlier
 * bumps so a rejected request never leaves partial device/IP counts.
 */
export async function tryBumpThrottles(
  admin: SupabaseClient,
  checks: ThrottleCheck[],
): Promise<boolean> {
  const peekResults = await Promise.all(
    checks.map((c) =>
      peekThrottle(admin, c.scope, c.bucket, c.period, c.cap)
    ),
  );
  if (peekResults.some((ok) => !ok)) return false;

  const bumped: ThrottleCheck[] = [];
  for (const check of checks) {
    const ok = await bumpThrottle(
      admin,
      check.scope,
      check.bucket,
      check.period,
      check.cap,
    );
    if (!ok) {
      for (let i = bumped.length - 1; i >= 0; i--) {
        const b = bumped[i];
        await decrementThrottle(admin, b.scope, b.bucket, b.period);
      }
      return false;
    }
    if (check.bucket) bumped.push(check);
  }
  return true;
}

/** Atomic "spend one credit if under quota" for the gateway-verified user id. */
export async function consumeAiCredit(
  admin: SupabaseClient,
  userId: string,
  period: string,
  quota: number,
  device: string | null = null,
): Promise<ConsumeResult> {
  if (!userId) return { granted: false, used: 0, quota };
  assertPeriod(period);
  assertQuota(quota);
  assertDeviceId(device);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data: row, error: readErr } = await admin
      .from("ai_usage")
      .select("used")
      .eq("user_id", userId)
      .eq("period_key", period)
      .maybeSingle();
    if (readErr) throw readErr;

    if (!row) {
      const { data: inserted, error: insErr } = await admin
        .from("ai_usage")
        .insert({
          user_id: userId,
          period_key: period,
          used: 1,
          device_id: device,
        })
        .select("used")
        .maybeSingle();
      if (insErr) {
        if (insErr.code === PG_UNIQUE_VIOLATION) continue;
        throw insErr;
      }
      if (inserted) return { granted: true, used: inserted.used, quota };
      continue;
    }

    const current = row.used;
    if (current >= quota) {
      return { granted: false, used: current, quota };
    }

    const patch: Record<string, unknown> = {
      used: current + 1,
      updated_at: new Date().toISOString(),
    };
    if (device != null) patch.device_id = device;

    const { data: updated, error: updErr } = await admin
      .from("ai_usage")
      .update(patch)
      .eq("user_id", userId)
      .eq("period_key", period)
      .eq("used", current)
      .select("used")
      .maybeSingle();
    if (updErr) throw updErr;
    if (updated) return { granted: true, used: updated.used, quota };
  }

  const { data: final, error: finalErr } = await admin
    .from("ai_usage")
    .select("used")
    .eq("user_id", userId)
    .eq("period_key", period)
    .maybeSingle();
  if (finalErr) throw finalErr;
  const used = final?.used ?? quota;
  return { granted: false, used, quota };
}

/** Per-device/IP soft cap. Empty bucket never blocks (shared NAT / missing signal). */
export async function bumpThrottle(
  admin: SupabaseClient,
  scope: string,
  bucket: string,
  period: string,
  cap: number,
): Promise<boolean> {
  validateThrottleInputs(scope, bucket, period, cap);
  if (!bucket) return true;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data: row, error: readErr } = await admin
      .from("ai_throttle")
      .select("used")
      .eq("scope", scope)
      .eq("bucket", bucket)
      .eq("period_key", period)
      .maybeSingle();
    if (readErr) throw readErr;

    if (!row) {
      const { data: inserted, error: insErr } = await admin
        .from("ai_throttle")
        .insert({ scope, bucket, period_key: period, used: 1 })
        .select("used")
        .maybeSingle();
      if (insErr) {
        if (insErr.code === PG_UNIQUE_VIOLATION) continue;
        throw insErr;
      }
      if (inserted) return true;
      continue;
    }

    if (row.used >= cap) return false;

    const { data: updated, error: updErr } = await admin
      .from("ai_throttle")
      .update({
        used: row.used + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("scope", scope)
      .eq("bucket", bucket)
      .eq("period_key", period)
      .eq("used", row.used)
      .select("used")
      .maybeSingle();
    if (updErr) throw updErr;
    if (updated) return true;
  }

  return false;
}
