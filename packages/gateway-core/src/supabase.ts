import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createAdminClient(
  supabaseUrl: string,
  serviceRoleKey: string,
): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export type UserEntitlementRow = {
  is_plus: boolean;
  expires_at: string | null;
};

/** Server reads Plus from Postgres — never trusts the client. */
export async function readUserEntitlement(
  admin: SupabaseClient,
  userId: string,
): Promise<{ isPlus: boolean; row: UserEntitlementRow | null }> {
  const { data, error } = await admin
    .from("user_entitlements")
    .select("is_plus, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { isPlus: false, row: null };
  const notExpired = !data.expires_at ||
    new Date(data.expires_at).getTime() > Date.now();
  return { isPlus: !!data.is_plus && notExpired, row: data };
}
