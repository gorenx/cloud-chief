import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { isAdmin, verifySupabaseJWT } from "./auth";
import { handleRevenueCatWebhook, handleSyncEntitlement } from "./billing";
import {
  RevenueCatError,
  forwardQuery,
  getChart,
  getCustomer,
  getCustomerActiveEntitlements,
  getCustomerSubscriptions,
  getMetricsOverview,
  getSubscription,
} from "./revenuecat";
import type { Env, Variables } from "./types";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["authorization", "content-type"],
  }),
);

app.get("/health", (c) => c.text("ok"));

app.post("/webhooks/revenuecat", handleRevenueCatWebhook);

function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const xff = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim();
  return xff || "unknown";
}

async function enforceRateLimit(
  limiter: Env["RATE_LIMITER"],
  key: string,
): Promise<void> {
  if (!limiter) return;
  const { success } = await limiter.limit({ key });
  if (!success) throw new HTTPException(429, { message: "rate limit exceeded" });
}

app.use("/v1/*", async (c, next) => {
  await enforceRateLimit(c.env.RATE_LIMITER, `ip:${clientIp(c.req.raw)}`);

  const auth = c.req.header("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new HTTPException(401, { message: "missing bearer token" });

  let claims;
  try {
    claims = await verifySupabaseJWT(m[1].trim(), c.env);
  } catch (e) {
    console.error("jwt verification failed", e);
    throw new HTTPException(401, { message: "invalid token" });
  }

  if (claims.sub) {
    await enforceRateLimit(c.env.RATE_LIMITER, `sub:${claims.sub}`);
  }

  c.set("claims", claims);
  await next();
});

function requireSub(c: { get: (k: "claims") => { sub?: string } }): string {
  const sub = c.get("claims").sub;
  if (!sub) throw new HTTPException(403, { message: "token missing sub claim" });
  return sub;
}

function requireAdmin(c: { env: Env; get: (k: "claims") => { sub?: string } }) {
  if (!isAdmin(c.get("claims"), c.env)) {
    throw new HTTPException(403, { message: "admin access required" });
  }
}

const LIST_QUERY = ["environment", "starting_after", "limit"] as const;
const METRICS_QUERY = ["currency"] as const;
const CHART_QUERY = ["resolution", "start_time", "end_time", "currency"] as const;

app.post("/v1/sync-entitlement", handleSyncEntitlement);

app.get("/v1/me", async (c) => {
  const customerId = requireSub(c);
  return c.json(await getCustomer(c.env, customerId));
});

app.get("/v1/me/subscriptions", async (c) => {
  const customerId = requireSub(c);
  const query = forwardQuery(new URL(c.req.url), [...LIST_QUERY]);
  return c.json(await getCustomerSubscriptions(c.env, customerId, query));
});

app.get("/v1/me/active-entitlements", async (c) => {
  const customerId = requireSub(c);
  const query = forwardQuery(new URL(c.req.url), [...LIST_QUERY]);
  return c.json(await getCustomerActiveEntitlements(c.env, customerId, query));
});

app.get("/v1/me/subscriptions/:subscriptionId", async (c) => {
  const customerId = requireSub(c);
  const sub = await getSubscription(c.env, c.req.param("subscriptionId"));
  const owner =
    typeof sub === "object" &&
    sub &&
    ("customer_id" in sub || "original_customer_id" in sub)
      ? String(
          (sub as { customer_id?: string; original_customer_id?: string }).customer_id ??
            (sub as { original_customer_id?: string }).original_customer_id,
        )
      : "";
  if (owner && owner !== customerId) {
    throw new HTTPException(403, { message: "subscription does not belong to this user" });
  }
  return c.json(sub);
});

app.get("/v1/metrics/overview", async (c) => {
  requireAdmin(c);
  const query = forwardQuery(new URL(c.req.url), [...METRICS_QUERY]);
  return c.json(await getMetricsOverview(c.env, query));
});

app.get("/v1/charts/:chartName", async (c) => {
  requireAdmin(c);
  const query = forwardQuery(new URL(c.req.url), [...CHART_QUERY]);
  return c.json(await getChart(c.env, c.req.param("chartName"), query));
});

app.notFound((c) =>
  c.json(
    {
      error: "not found",
      hint: "use POST /webhooks/revenuecat, POST /v1/sync-entitlement, GET /v1/me/*",
    },
    404,
  ),
);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  if (err instanceof RevenueCatError) {
    const status = err.status as 400 | 401 | 403 | 404 | 429 | 500 | 503 | 504;
    return c.json({ error: err.message, detail: err.body ?? null }, status);
  }
  return c.json({ error: "internal error", detail: (err as Error).message }, 500);
});

export default app;
