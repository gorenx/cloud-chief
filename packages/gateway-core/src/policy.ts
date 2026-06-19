// Server-side AI + billing policy. Client never dictates these numbers.
//
// Model ids default for Qwen via Cloudflare AI Gateway; override per Worker via
// wrangler [vars] FREE_MODEL / PLUS_MODEL. PLUS_ENTITLEMENT_ID must match
// RevenueCat and the Flutter client (WrenRules.proEntitlementId).

export const FREE_MODEL = "qwen-plus";
export const PLUS_MODEL = "qwen3-max";
export const PLUS_ENTITLEMENT_ID = "wren Pro";

/** Supabase user access_token `aud` claim; override via wrangler [vars]. */
export const JWT_AUDIENCE = "authenticated";

/** Per-user daily ceiling for free, authenticated users (UTC day). */
export const FREE_DAILY_CEILING = 8;

/** Server-fixed per-call token budget when the gateway patches the request body. */
export const MAX_TOKENS = 4096;

/** Reject absurdly large prompts before they reach the upstream provider. */
export const MAX_PROMPT_CHARS = 100_000;

/** Sybil defense-in-depth (generous soft caps). */
export const DEVICE_DAILY_CAP = 16;
export const IP_DAILY_CAP = 64;
