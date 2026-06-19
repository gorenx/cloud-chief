import type { JWTPayload } from "jose";

/** Cloudflare 原生限流 binding（[[unsafe.bindings]] type="ratelimit"）。 */
export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  // vars
  CF_ACCOUNT_ID: string;
  CF_GATEWAY_ID: string;
  PROVIDER_SLUG: string;
  DEFAULT_MODEL: string;
  FREE_MODEL?: string;
  PLUS_MODEL?: string;
  SUPABASE_URL: string;
  JWT_AUDIENCE?: string;
  ALLOWED_SUBS?: string;
  UPSTREAM_TIMEOUT_MS?: string;
  /** Free-tier limits; see gateway-core resolveGatewayLimits(). */
  FREE_DAILY_CEILING?: string;
  MAX_TOKENS?: string;
  MAX_PROMPT_CHARS?: string;
  DEVICE_DAILY_CAP?: string;
  IP_DAILY_CAP?: string;
  // secrets
  CF_AIG_TOKEN?: string;
  DASHSCOPE_API_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_JWT_SECRET?: string;
  // bindings
  RATE_LIMITER?: RateLimitBinding;
}

export type Variables = {
  claims: JWTPayload;
};

export type UpstreamKind = "chat" | "responses";
