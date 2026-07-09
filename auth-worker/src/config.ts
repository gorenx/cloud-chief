import type { Env } from "./types";

export function appName(env: Env): string {
  return env.APP_NAME?.trim() || "Auth Worker";
}

export function baseURL(env: Env, request: Request): string {
  const configured = env.BETTER_AUTH_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return new URL(request.url).origin;
}

export function trustedOrigins(env: Env, request: Request): string[] {
  const origins = new Set<string>([
    baseURL(env, request),
    ...csv(env.TRUSTED_ORIGINS),
  ]);
  if (env.FRONTEND_URL?.trim()) origins.add(env.FRONTEND_URL.trim());
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
    .map((item) => item.trim())
    .filter(Boolean);
}
