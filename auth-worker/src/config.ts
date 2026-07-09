import type { Env } from "./types";

export function appName(env: Env): string {
  return env.APP_NAME?.trim() || "Auth Worker";
}

export function baseURL(env: Env, request: Request): string {
  const requestOrigin = new URL(request.url).origin;
  const configured = originFromURL(env.BETTER_AUTH_URL);
  if (!configured) return requestOrigin;

  // wrangler.toml keeps localhost defaults for local dev. If that file is
  // deployed unchanged, Better Auth would reject the real workers.dev/custom
  // domain Origin. In production-like requests, prefer the actual auth origin.
  if (isLocalOrigin(configured) && !isLocalOrigin(requestOrigin)) return requestOrigin;

  return configured;
}

export function trustedOrigins(env: Env, request: Request): string[] {
  const requestOrigin = new URL(request.url).origin;
  const origins = new Set<string>([
    baseURL(env, request),
    requestOrigin,
    ...csv(env.TRUSTED_ORIGINS),
  ]);
  const frontend = originFromURL(env.FRONTEND_URL);
  if (frontend) origins.add(frontend);
  return [...origins];
}

export function corsOrigin(
  env: Env,
  request: Request,
  origin: string | undefined,
): string | null {
  if (!origin) return null;
  return trustedOrigins(env, request).includes(origin) ? origin : null;
}

export function isEnabled(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test(value ?? "");
}

function csv(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((item) => originFromURL(item))
    .filter((item): item is string => Boolean(item));
}

function originFromURL(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/+$/, "");
  }
}

function isLocalOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(origin);
  }
}
