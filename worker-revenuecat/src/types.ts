import type { JWTPayload } from "jose";

export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  RC_PROJECT_ID: string;
  SUPABASE_URL: string;
  JWT_AUDIENCE?: string;
  ALLOWED_SUBS?: string;
  UPSTREAM_TIMEOUT_MS?: string;
  /** RevenueCat v2 Secret API Key — read-only customer/subscription APIs */
  REVENUECAT_SECRET_API_KEY: string;
  /** RevenueCat v1 REST API Key — subscriber mirror for webhook/sync */
  REVENUECAT_REST_API_KEY?: string;
  /** Bearer token RevenueCat sends on webhooks */
  REVENUECAT_WEBHOOK_SECRET?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_JWT_SECRET?: string;
  RATE_LIMITER?: RateLimitBinding;
}

export type Variables = {
  claims: JWTPayload;
};
