import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth, requireJwt, requireSession, sessionFromRequest } from "./auth";
import { appName, corsOrigin } from "./config";
import { json, problem } from "./http";
import { consentPage, signInPage, signUpPage } from "./pages";
import type { AppBindings } from "./types";

export function createApp() {
  const app = new Hono<AppBindings>();

  app.use(
    "*",
    cors({
      origin: (origin, c) => corsOrigin(c.env, c.req.raw, origin) ?? "",
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["authorization", "content-type"],
      exposeHeaders: ["set-auth-token", "set-auth-jwt"],
      credentials: true,
      maxAge: 600,
    }),
  );

  app.get("/", (c) =>
    json({
      ok: true,
      service: appName(c.env),
      authBasePath: "/api/auth",
      endpoints: {
        signInPage: "/sign-in",
        signUpPage: "/sign-up",
        betterAuth: "/api/auth/*",
        session: "/api/session",
        jwtProtected: "/api/protected/jwt",
        sessionProtected: "/api/protected/session",
        jwks: "/api/auth/jwks",
        oauthDiscovery: "/.well-known/openid-configuration",
      },
    }),
  );

  app.get("/health", (c) => c.text("ok"));
  app.get("/sign-in", signInPage);
  app.get("/sign-up", signUpPage);
  app.get("/consent", consentPage);

  app.on(["GET", "POST"], "/api/auth/*", (c) => {
    return createAuth(c.env, c.req.raw).handler(c.req.raw);
  });

  app.on(["GET", "POST"], "/.well-known/*", (c) => {
    return createAuth(c.env, c.req.raw).handler(c.req.raw);
  });

  app.get("/api/session", async (c) => {
    const session = await sessionFromRequest(c);
    return json({ authenticated: Boolean(session), session });
  });

  app.get("/api/protected/session", requireSession, (c) => {
    return json({
      ok: true,
      auth: "better-auth-session",
      user: c.get("session")?.user,
    });
  });

  app.get("/api/protected/jwt", requireJwt, (c) => {
    return json({
      ok: true,
      auth: "jwt",
      payload: c.get("jwtPayload"),
    });
  });

  app.notFound(() => problem(404, "not_found"));

  app.onError((error) => {
    console.error(error);
    return problem(500, "internal_error", error instanceof Error ? error.message : String(error));
  });

  return app;
}
