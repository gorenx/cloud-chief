import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import type { JWTPayload } from "jose";
import { verifySupabaseJWT } from "./auth";
import {
  enforceGatewayPolicy,
  patchUpstreamBody,
  policyResponseHeaders,
  type GatewayPolicy,
} from "./enforce";
import { forward } from "./gateway";
import type { Env, UpstreamKind, Variables } from "./types";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["POST", "GET", "OPTIONS"],
    allowHeaders: ["authorization", "content-type", "x-device-id"],
    exposeHeaders: ["x-wren-tier", "x-wren-used", "x-wren-quota"],
  }),
);

app.get("/health", (c) => c.text("ok"));

app.use("/v1/*", async (c, next) => {
  const auth = c.req.header("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new HTTPException(401, { message: "missing bearer token" });

  let claims: JWTPayload;
  try {
    claims = await verifySupabaseJWT(m[1].trim(), c.env);
  } catch (e) {
    throw new HTTPException(401, { message: `invalid token: ${(e as Error).message}` });
  }

  if (c.env.ALLOWED_SUBS) {
    const allow = c.env.ALLOWED_SUBS.split(",").map((s) => s.trim()).filter(Boolean);
    if (allow.length && (!claims.sub || !allow.includes(claims.sub))) {
      throw new HTTPException(403, { message: "user not allowed" });
    }
  }

  if (c.env.RATE_LIMITER && claims.sub) {
    const { success } = await c.env.RATE_LIMITER.limit({ key: claims.sub });
    if (!success) throw new HTTPException(429, { message: "rate limit exceeded" });
  }

  c.set("claims", claims);
  await next();
});

function metadata(claims: JWTPayload, policy: GatewayPolicy): Record<string, unknown> {
  return {
    sub: claims.sub ?? "",
    email: (claims as Record<string, unknown>).email ?? "",
    role: (claims as Record<string, unknown>).role ?? "",
    tier: policy.tier,
    used: policy.used,
    quota: policy.quota,
  };
}

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

function handler(kind: UpstreamKind) {
  return async (c: AppContext) => {
    const claims = c.get("claims");
    const rawBody = await c.req.text();
    const policyOrReject = await enforceGatewayPolicy(c.env, c.req.raw, claims, rawBody);
    if ("status" in policyOrReject) {
      return c.json(policyOrReject.body, policyOrReject.status as 400 | 429 | 500);
    }
    const policy = policyOrReject;
    const body = patchUpstreamBody(rawBody, policy.model);
    const upstream = await forward(
      c.env,
      kind,
      body,
      metadata(claims, policy),
    );
    const headers = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(policyResponseHeaders(policy))) {
      headers.set(k, v);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  };
}

app.post("/v1/chat/completions", handler("chat"));
app.post("/v1/responses", handler("responses"));

app.notFound((c) =>
  c.json({ error: "not found", hint: "use POST /v1/chat/completions or /v1/responses" }, 404),
);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  return c.json({ error: "internal error", detail: (err as Error).message }, 500);
});

export default app;
