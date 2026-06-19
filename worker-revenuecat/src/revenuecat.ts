import type { Env } from "./types";

const RC_BASE = "https://api.revenuecat.com/v2";

export class RevenueCatError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "RevenueCatError";
  }
}

function timeoutMs(env: Env): number {
  const n = Number(env.UPSTREAM_TIMEOUT_MS ?? "30000");
  return Number.isFinite(n) && n > 0 ? n : 30000;
}

function projectPath(env: Env, suffix: string): string {
  return `${RC_BASE}/projects/${encodeURIComponent(env.RC_PROJECT_ID)}${suffix}`;
}

async function rcFetch(env: Env, path: string, init?: RequestInit): Promise<Response> {
  if (!env.REVENUECAT_SECRET_API_KEY) {
    throw new RevenueCatError(500, "REVENUECAT_SECRET_API_KEY is not configured");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs(env));

  try {
    return await fetch(path, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.REVENUECAT_SECRET_API_KEY}`,
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new RevenueCatError(504, "RevenueCat API timeout");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function rcJson<T>(env: Env, path: string, init?: RequestInit): Promise<T> {
  const res = await rcFetch(env, path, init);
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const msg =
      typeof body === "object" && body && "message" in body
        ? String((body as { message: unknown }).message)
        : `RevenueCat API error (${res.status})`;
    throw new RevenueCatError(res.status, msg, body);
  }

  return body as T;
}

/** 透传允许的 query 参数到 RevenueCat。 */
export function forwardQuery(url: URL, allowed: string[]): string {
  const out = new URLSearchParams();
  for (const key of allowed) {
    const v = url.searchParams.get(key);
    if (v != null && v !== "") out.set(key, v);
  }
  const qs = out.toString();
  return qs ? `?${qs}` : "";
}

export async function getCustomer(env: Env, customerId: string) {
  return rcJson<unknown>(
    env,
    projectPath(env, `/customers/${encodeURIComponent(customerId)}`),
  );
}

export async function getCustomerSubscriptions(env: Env, customerId: string, query = "") {
  return rcJson<unknown>(
    env,
    projectPath(env, `/customers/${encodeURIComponent(customerId)}/subscriptions${query}`),
  );
}

export async function getCustomerActiveEntitlements(env: Env, customerId: string, query = "") {
  return rcJson<unknown>(
    env,
    projectPath(env, `/customers/${encodeURIComponent(customerId)}/active_entitlements${query}`),
  );
}

export async function getSubscription(env: Env, subscriptionId: string) {
  return rcJson<unknown>(
    env,
    projectPath(env, `/subscriptions/${encodeURIComponent(subscriptionId)}`),
  );
}

export async function getMetricsOverview(env: Env, query = "") {
  return rcJson<unknown>(env, projectPath(env, `/metrics/overview${query}`));
}

export async function getChart(env: Env, chartName: string, query = "") {
  return rcJson<unknown>(
    env,
    projectPath(env, `/charts/${encodeURIComponent(chartName)}${query}`),
  );
}
