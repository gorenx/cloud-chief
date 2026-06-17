import type {
  AdminState,
  GatewayContext,
  PublicConfig,
  WorkerList,
  WorkerStatus,
} from "@/types";

export function errText(j: unknown): string {
  if (!j) return "未知错误";
  if (typeof j === "object" && j !== null) {
    const o = j as Record<string, unknown>;
    if (typeof o.error === "string") return o.error;
    if (o.error) return JSON.stringify(o.error);
    if (Array.isArray(o.errors)) {
      return o.errors
        .map((e) =>
          typeof e === "object" && e && "message" in e
            ? String((e as { message: string }).message)
            : JSON.stringify(e),
        )
        .join("; ");
    }
  }
  return JSON.stringify(j);
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

function authHeaders(token: string, extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function adminFetch<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const res = await fetch(path, {
    method,
    headers: authHeaders(token, body ? { "Content-Type": "application/json" } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await parseJson<T & { success?: boolean; error?: string }>(res);
  const failed = !res.ok || (j && typeof j === "object" && "success" in j && j.success === false);
  if (failed) {
    return { ok: false, status: res.status, error: errText(j) };
  }
  return { ok: true, data: j as T };
}

export async function fetchState(token: string) {
  return adminFetch<AdminState>(token, "GET", "/admin/state");
}

export async function fetchGatewayContext(token: string, id: string) {
  return adminFetch<GatewayContext>(token, "GET", `/admin/gateways/${encodeURIComponent(id)}/context`);
}

export async function fetchPublicConfig() {
  const res = await fetch("/config");
  const j = await parseJson<PublicConfig>(res);
  if (!res.ok || !j) return { ok: false as const, status: res.status, error: "无法读取配置" };
  return { ok: true as const, data: j };
}

export async function fetchKeys(token: string, gateway: string) {
  return adminFetch<{ result?: unknown[] }>(
    token,
    "GET",
    `/admin/keys?gateway=${encodeURIComponent(gateway)}`,
  );
}

export async function fetchWorkerList(token: string) {
  return adminFetch<WorkerList>(token, "GET", "/admin/worker/workers");
}

export async function fetchWorkerStatus(token: string, dir?: string) {
  const q = dir ? `?dir=${encodeURIComponent(dir)}` : "";
  return adminFetch<WorkerStatus>(token, "GET", `/admin/worker/status${q}`);
}

export async function fetchWorkerSecrets(token: string, dir?: string) {
  const q = dir ? `?dir=${encodeURIComponent(dir)}` : "";
  return adminFetch<{ ok: boolean; names: string[] }>(token, "GET", `/admin/worker/secrets${q}`);
}

export function buildInvokeUrl(
  accountId: string,
  gateway: string,
  providerSlug: string,
  path: string,
): string {
  if (!gateway || !providerSlug) return "";
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gateway}/custom-${providerSlug}${path}`;
}
