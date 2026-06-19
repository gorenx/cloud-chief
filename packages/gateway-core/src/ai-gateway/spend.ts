import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpendFreeResult } from "./types.js";
import { validateSpendInputs } from "./validate.js";

type RpcSpendRow = {
  granted?: boolean;
  reason?: string;
  used?: number;
  quota?: number;
};

function parseSpendRow(raw: unknown, quota: number): SpendFreeResult {
  const row = (raw ?? {}) as RpcSpendRow;
  const used = typeof row.used === "number" ? row.used : 0;
  const q = typeof row.quota === "number" ? row.quota : quota;
  if (row.granted === true) {
    return { granted: true, used, quota: q };
  }
  const reason = row.reason === "throttled" ? "throttled" : "over_quota";
  return { granted: false, reason, used, quota: q };
}

/** Atomic free-tier spend via spend_free_ai_credit() (0003_ai_gateway_rpc.sql). */
export async function spendFreeAiCredit(
  admin: SupabaseClient,
  userId: string,
  period: string,
  quota: number,
  device: string | null,
  ip: string | null,
  deviceCap: number,
  ipCap: number,
): Promise<SpendFreeResult> {
  if (!userId) return { granted: false, reason: "over_quota", used: 0, quota };
  validateSpendInputs(period, quota, device, deviceCap, ipCap);

  const { data, error } = await admin.rpc("spend_free_ai_credit", {
    p_user_id: userId,
    p_period: period,
    p_quota: quota,
    p_device: device,
    p_ip: ip,
    p_device_cap: deviceCap,
    p_ip_cap: ipCap,
  });
  if (error) throw error;
  return parseSpendRow(data, quota);
}
