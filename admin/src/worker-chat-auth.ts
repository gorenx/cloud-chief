import { fetchSupabaseAccessToken } from "./supabase-auth";
import { normalizeWorkerBaseUrl } from "./worker-path";
import { getWorkerRuntimeConfig, parseWorkerEndpoint, pickWorkerUrl } from "./worker-runtime";

export type WorkerChatAuthPayload = {
  worker_dir?: string;
  worker_target?: string;
  worker_base?: string;
  access_token?: string;
  email?: string;
  password?: string;
};

export type WorkerChatAuthResult =
  | {
      ok: true;
      base: string;
      target: string;
      accessToken: string;
    }
  | { ok: false; error: string; status?: 400 };

export async function resolveWorkerChatAuth(
  payload: WorkerChatAuthPayload,
  options?: { requireToken?: boolean },
): Promise<WorkerChatAuthResult> {
  const runtime = await getWorkerRuntimeConfig({
    dir: typeof payload.worker_dir === "string" ? payload.worker_dir : undefined,
  });
  const endpoint = parseWorkerEndpoint(payload.worker_target);
  const customBase = typeof payload.worker_base === "string" ? payload.worker_base.trim() : "";
  const picked = pickWorkerUrl(runtime, endpoint);
  if (picked.error && !customBase) {
    return { ok: false, error: picked.error, status: 400 };
  }

  let base = picked.url.replace(/\/$/, "");
  if (customBase) {
    const normalized = normalizeWorkerBaseUrl(customBase);
    if ("error" in normalized) {
      return { ok: false, error: normalized.error, status: 400 };
    }
    base = normalized.url;
  }
  const requireToken = options?.requireToken !== false;

  if (!requireToken) {
    return { ok: true, base, target: endpoint, accessToken: "" };
  }

  const supabaseUrl = runtime.vars.SUPABASE_URL;
  if (!supabaseUrl) {
    return {
      ok: false,
      error: "Worker 未配置 SUPABASE_URL（CF 部署 vars 或 wrangler.toml）",
      status: 400,
    };
  }

  let accessToken =
    typeof payload.access_token === "string" && payload.access_token.trim()
      ? payload.access_token.trim()
      : "";

  if (!accessToken) {
    const auth = await fetchSupabaseAccessToken(supabaseUrl, {
      email: typeof payload.email === "string" ? payload.email.trim() : undefined,
      password: typeof payload.password === "string" ? payload.password : undefined,
    });
    if ("error" in auth) return { ok: false, error: auth.error, status: 400 };
    accessToken = auth.access_token;
  }

  return { ok: true, base, target: endpoint, accessToken };
}
