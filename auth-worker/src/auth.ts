import { oauthProvider } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { bearer, jwt } from "better-auth/plugins";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { baseURL, isEnabled, trustedOrigins } from "./config";
import { problem } from "./http";
import type { AppContext, AuthSession, Env } from "./types";

export function createAuth(env: Env, request: Request) {
  const issuer = baseURL(env, request);
  const oauthStrict = isEnabled(env.OAUTH_STRICT);

  return betterAuth({
    appName: env.APP_NAME?.trim() || "Auth Worker",
    baseURL: issuer,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    database: env.DB,
    trustedOrigins: trustedOrigins(env, request),
    disabledPaths: oauthStrict ? ["/token"] : [],
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: socialProviders(env),
    plugins: [
      bearer(),
      jwt({
        disableSettingJwtHeader: oauthStrict,
        jwks: {
          jwksPath: "/jwks",
          keyPairConfig: {
            alg: "EdDSA",
            crv: "Ed25519",
          },
        },
      }),
      oauthProvider({
        loginPage: "/sign-in",
        consentPage: "/consent",
        allowDynamicClientRegistration: true,
        allowPublicClientPrelogin: true,
      }),
    ],
  });
}

export async function sessionFromRequest(c: AppContext): Promise<AuthSession | null> {
  const auth = createAuth(c.env, c.req.raw);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return (session as AuthSession | null) ?? null;
}

export async function requireSession(c: AppContext, next: () => Promise<void>) {
  const session = await sessionFromRequest(c);
  if (!session) {
    return problem(401, "unauthorized", "missing or invalid Better Auth session");
  }
  c.set("session", session);
  await next();
}

export async function requireJwt(c: AppContext, next: () => Promise<void>) {
  const payload = await verifyJwt(c);
  if (payload instanceof Response) return payload;
  c.set("jwtPayload", payload);
  await next();
}

function socialProviders(env: Env) {
  const providers: Record<string, { clientId: string; clientSecret: string }> = {};
  if (env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim()) {
    providers.google = {
      clientId: env.GOOGLE_CLIENT_ID.trim(),
      clientSecret: env.GOOGLE_CLIENT_SECRET.trim(),
    };
  }
  if (env.GITHUB_CLIENT_ID?.trim() && env.GITHUB_CLIENT_SECRET?.trim()) {
    providers.github = {
      clientId: env.GITHUB_CLIENT_ID.trim(),
      clientSecret: env.GITHUB_CLIENT_SECRET.trim(),
    };
  }
  return providers;
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function verifyJwt(c: AppContext): Promise<Record<string, unknown> | Response> {
  const token = bearerToken(c.req.raw);
  if (!token) return problem(401, "unauthorized", "missing bearer JWT");

  try {
    const issuer = baseURL(c.env, c.req.raw);
    const jwks = createRemoteJWKSet(new URL("/api/auth/jwks", issuer));
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: issuer,
    });
    return payload as Record<string, unknown>;
  } catch (error) {
    return problem(401, "invalid_jwt", error instanceof Error ? error.message : String(error));
  }
}
