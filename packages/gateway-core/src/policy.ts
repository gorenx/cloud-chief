// Server-side AI + billing policy. Client never dictates these numbers.
//
// Defaults below; override per deployment via ai-gateway-worker wrangler [vars]:
// FREE_DAILY_CEILING, MAX_TOKENS, MAX_PROMPT_CHARS, DEVICE_DAILY_CAP, IP_DAILY_CAP.
// Model ids: FREE_MODEL / PLUS_MODEL. PLUS_ENTITLEMENT_ID must match RevenueCat
// and the Flutter client (WrenRules.proEntitlementId).

export const FREE_MODEL = "qwen-plus";
export const PLUS_MODEL = "qwen-plus";
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

export class PolicyConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyConfigError";
  }
}

export type GatewayLimits = {
  freeDailyCeiling: number;
  maxTokens: number;
  maxPromptChars: number;
  deviceDailyCap: number;
  ipDailyCap: number;
};

/** wrangler [vars] keys (all optional string integers). */
export type GatewayLimitsEnv = {
  FREE_DAILY_CEILING?: string;
  MAX_TOKENS?: string;
  MAX_PROMPT_CHARS?: string;
  DEVICE_DAILY_CAP?: string;
  IP_DAILY_CAP?: string;
};

function parseBoundedInt(
  key: string,
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new PolicyConfigError(`${key} must be an integer ${min}-${max}`);
  }
  return n;
}

export function resolveGatewayLimits(env: GatewayLimitsEnv): GatewayLimits {
  return {
    freeDailyCeiling: parseBoundedInt(
      "FREE_DAILY_CEILING",
      env.FREE_DAILY_CEILING,
      FREE_DAILY_CEILING,
      1,
      100,
    ),
    maxTokens: parseBoundedInt(
      "MAX_TOKENS",
      env.MAX_TOKENS,
      MAX_TOKENS,
      1,
      8192,
    ),
    maxPromptChars: parseBoundedInt(
      "MAX_PROMPT_CHARS",
      env.MAX_PROMPT_CHARS,
      MAX_PROMPT_CHARS,
      1024,
      500_000,
    ),
    deviceDailyCap: parseBoundedInt(
      "DEVICE_DAILY_CAP",
      env.DEVICE_DAILY_CAP,
      DEVICE_DAILY_CAP,
      1,
      1000,
    ),
    ipDailyCap: parseBoundedInt(
      "IP_DAILY_CAP",
      env.IP_DAILY_CAP,
      IP_DAILY_CAP,
      1,
      1000,
    ),
  };
}
