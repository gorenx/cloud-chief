import { env } from "./env";

export async function fetchSupabaseAccessToken(
  supabaseUrl: string,
  opts: { email?: string; password?: string; anonKey?: string } = {},
): Promise<{ access_token: string } | { error: string }> {
  const email = opts.email || env.SUPABASE_TEST_EMAIL;
  const password = opts.password || env.SUPABASE_TEST_PASSWORD;
  const anonKey = opts.anonKey || env.SUPABASE_ANON_KEY;

  if (!email || !password || !anonKey) {
    return {
      error:
        "缺少 Supabase 凭据：请在请求体传 access_token，或在 admin/.env 配置 SUPABASE_ANON_KEY、SUPABASE_TEST_EMAIL、SUPABASE_TEST_PASSWORD",
    };
  }

  const base = supabaseUrl.replace(/\/$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
  } catch (e) {
    return { error: (e as Error).message };
  }

  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error_description?: string;
    msg?: string;
  };

  if (!res.ok || !json.access_token) {
    const msg = json.error_description || json.msg || `Supabase 登录失败 (${res.status})`;
    return { error: msg };
  }
  return { access_token: json.access_token };
}
