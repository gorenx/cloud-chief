import type { JWTPayload } from "jose";
import {
  AiGatewayError,
  createAdminClient,
  DEVICE_DAILY_CAP,
  FREE_DAILY_CEILING,
  FREE_MODEL,
  IP_DAILY_CAP,
  MAX_PROMPT_CHARS,
  MAX_TOKENS,
  PLUS_MODEL,
  readUserEntitlement,
  spendFreeAiCredit,
  utcPeriodKey,
} from "@cloud-chief/gateway-core";
import type { Env } from "./types";

export type GatewayPolicy = {
  isPlus: boolean;
  tier: "plus" | "free";
  model: string;
  used: number;
  quota: number;
};

export type PolicyReject = {
  status: number;
  body: Record<string, unknown>;
};

function resolveModel(env: Env, isPlus: boolean): string {
  if (isPlus) return env.PLUS_MODEL?.trim() || PLUS_MODEL;
  return env.FREE_MODEL?.trim() || env.DEFAULT_MODEL?.trim() || FREE_MODEL;
}

function clientIp(req: Request): string | null {
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const xff = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim();
  return xff || null;
}

function deviceId(req: Request): string | null {
  const raw = req.headers.get("x-device-id")?.trim();
  if (!raw) return null;
  return raw.slice(0, 80);
}

/** Bound prompt size before upstream (Responses + Chat Completions shapes). */
export function estimatePromptChars(bodyText: string): number | null {
  try {
    const payload = JSON.parse(bodyText) as Record<string, unknown>;
    if (typeof payload.prompt === "string") return payload.prompt.length;
    if (Array.isArray(payload.messages)) {
      return JSON.stringify(payload.messages).length;
    }
    if (Array.isArray(payload.input)) {
      return JSON.stringify(payload.input).length;
    }
    return null;
  } catch {
    return null;
  }
}

export function patchUpstreamBody(bodyText: string, model: string): string {
  try {
    const payload = JSON.parse(bodyText) as Record<string, unknown>;
    payload.model = model;
    if (typeof payload.max_tokens === "number") {
      payload.max_tokens = Math.min(payload.max_tokens, MAX_TOKENS);
    } else if (typeof payload.max_output_tokens === "number") {
      payload.max_output_tokens = Math.min(payload.max_output_tokens, MAX_TOKENS);
    }
    return JSON.stringify(payload);
  } catch {
    return bodyText;
  }
}

export async function enforceGatewayPolicy(
  env: Env,
  req: Request,
  claims: JWTPayload,
  bodyText: string,
): Promise<GatewayPolicy | PolicyReject> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { status: 500, body: { error: "gateway_misconfigured" } };
  }
  const userId = claims.sub;
  if (!userId) {
    return { status: 403, body: { error: "token missing sub claim" } };
  }

  const promptLen = estimatePromptChars(bodyText);
  if (promptLen !== null && promptLen > MAX_PROMPT_CHARS) {
    return { status: 400, body: { error: "bad_prompt" } };
  }

  const admin = createAdminClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { isPlus } = await readUserEntitlement(admin, userId);
  const model = resolveModel(env, isPlus);

  if (isPlus) {
    return {
      isPlus: true,
      tier: "plus",
      model,
      used: 0,
      quota: 0,
    };
  }

  const period = utcPeriodKey();
  const dev = deviceId(req);
  const ip = clientIp(req);

  let spend;
  try {
    spend = await spendFreeAiCredit(
      admin,
      userId,
      period,
      FREE_DAILY_CEILING,
      dev,
      ip,
      DEVICE_DAILY_CAP,
      IP_DAILY_CAP,
    );
  } catch (e) {
    if (e instanceof AiGatewayError) {
      return { status: 500, body: { error: "quota_failed" } };
    }
    throw e;
  }

  if (!spend.granted) {
    if (spend.reason === "throttled") {
      return { status: 429, body: { error: "throttled" } };
    }
    return {
      status: 429,
      body: {
        error: "over_quota",
        used: spend.used,
        quota: FREE_DAILY_CEILING,
      },
    };
  }

  return {
    isPlus: false,
    tier: "free",
    model,
    used: spend.used,
    quota: spend.quota,
  };
}

export function policyResponseHeaders(policy: GatewayPolicy): Record<string, string> {
  return {
    "x-wren-tier": policy.tier,
    "x-wren-used": String(policy.used),
    "x-wren-quota": String(policy.quota),
  };
}
