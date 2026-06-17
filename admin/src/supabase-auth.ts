import { env } from "./env";

export async function fetchSupabaseAccessToken(
  supabaseUrl: string,
  opts: { email?: string; password?: string; anonKey?: string } = {},
): Promise<{ access_token: string } | { error: string }> {
  const email = opts.email || env.SUPABASE_TEST_EMAIL;
  const password = opts.password || env.SUPABASE_TEST_PASSWORD;
  const anonKey = opts.anonKey || env.SUPABASE_ANON_KEY;

  if (!anonKey) {
    return {
      error:
        "缺少 SUPABASE_ANON_KEY：请在 Playground 应用 Supabase 项目配置，或在 admin/.env 填写",
    };
  }
  if (!email || !password) {
    return {
      error:
        "缺少用户 JWT：请粘贴 access_token，或在 Playground 填写测试账号邮箱/密码，或在 admin/.env 配置 SUPABASE_TEST_EMAIL / SUPABASE_TEST_PASSWORD",
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
    const raw = json.error_description || json.msg || `Supabase 登录失败 (${res.status})`;
    const msg = mapSupabaseLoginError(raw, email);
    return { error: msg };
  }
  return { access_token: json.access_token };
}

function mapSupabaseLoginError(raw: string, email: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("invalid login credentials") || lower.includes("invalid_credentials")) {
    return [
      `Supabase 登录失败：邮箱或密码不正确（${email}）`,
      "请在 Supabase 控制台 → Authentication → Users 确认该用户已存在且密码一致",
      "若刚创建用户，检查是否需邮箱验证；或到 Providers 确认已启用 Email 登录",
    ].join("；");
  }
  if (lower.includes("email not confirmed")) {
    return `Supabase 登录失败：邮箱 ${email} 尚未验证，请在 Supabase 邮件中完成确认或关闭「Confirm email」`;
  }
  return raw;
}
