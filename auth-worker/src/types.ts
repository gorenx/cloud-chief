import type { Context } from "hono";

export type Env = {
  DB: D1Database;
  APP_NAME?: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL?: string;
  FRONTEND_URL?: string;
  TRUSTED_ORIGINS?: string;
  OAUTH_STRICT?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
};

export type AuthSession = {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    emailVerified?: boolean;
    image?: string | null;
  };
  session: {
    id: string;
    userId: string;
    expiresAt?: Date | string;
  };
};

export type AppVariables = {
  session: AuthSession | null;
  jwtPayload: Record<string, unknown> | null;
};

export type AppBindings = {
  Bindings: Env;
  Variables: AppVariables;
};

export type AppContext = Context<AppBindings>;
