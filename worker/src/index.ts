import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import type { JWTPayload } from "jose";
import { verifySupabaseJWT } from "./auth";
import { forward } from "./gateway";
import type { Env, UpstreamKind, Variables } from "./types";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["POST", "GET", "OPTIONS"],
    allowHeaders: ["authorization", "content-type"],
  }),
);

app.get("/health", (c) => c.text("ok"));

// /v1/* 统一鉴权 + 限流
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

  // 可选用户白名单
  if (c.env.ALLOWED_SUBS) {
    const allow = c.env.ALLOWED_SUBS.split(",").map((s) => s.trim()).filter(Boolean);
    if (allow.length && (!claims.sub || !allow.includes(claims.sub))) {
      throw new HTTPException(403, { message: "user not allowed" });
    }
  }

  // 按用户限流（配置了 RATE_LIMITER binding 才生效）
  if (c.env.RATE_LIMITER && claims.sub) {
    const { success } = await c.env.RATE_LIMITER.limit({ key: claims.sub });
    if (!success) throw new HTTPException(429, { message: "rate limit exceeded" });
  }

  c.set("claims", claims);
  await next();
});

function metadata(claims: JWTPayload): Record<string, unknown> {
  return {
    sub: claims.sub ?? "",
    email: (claims as Record<string, unknown>).email ?? "",
    role: (claims as Record<string, unknown>).role ?? "",
  };
}

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

function handler(kind: UpstreamKind) {
  return async (c: AppContext) => {
    const claims = c.get("claims");
    return forward(c.env, kind, await c.req.text(), metadata(claims));
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
