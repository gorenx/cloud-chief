# Cloud Chief Auth Worker

Better Auth + Cloudflare Worker + D1 authentication service.

This Worker provides:

- Email/password sign up and sign in
- Better Auth session cookies
- JWT issuing and JWKS verification
- OAuth Provider endpoints
- Optional Google/GitHub social login
- Minimal fallback sign-in, sign-up, and OAuth consent pages

## Setup

Install dependencies from the repo root:

```bash
pnpm install
```

Create a D1 database:

```bash
pnpm --filter cloud-chief-auth-worker run db:create
```

Copy the returned `database_id` into `auth-worker/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "cloud-chief-auth"
database_id = "your-d1-database-id"
```

Create a Better Auth secret:

```bash
openssl rand -base64 32
```

For local development, put it in `auth-worker/.dev.vars`:

```env
BETTER_AUTH_SECRET="your-random-secret"
```

For production:

```bash
pnpm --filter cloud-chief-auth-worker exec wrangler secret put BETTER_AUTH_SECRET
```

Apply D1 migrations:

```bash
pnpm --filter cloud-chief-auth-worker run db:migrate:local
pnpm --filter cloud-chief-auth-worker run db:migrate:remote
```

Start locally:

```bash
pnpm --filter cloud-chief-auth-worker dev
```

Default local URL:

```txt
http://localhost:8790
```

## Web App Usage

Your app can call the Better Auth endpoints directly.

### Sign Up

```ts
await fetch("https://auth.example.com/api/auth/sign-up/email", {
  method: "POST",
  headers: { "content-type": "application/json" },
  credentials: "include",
  body: JSON.stringify({
    name: "Alice",
    email: "alice@example.com",
    password: "strong-password",
  }),
});
```

### Sign In

```ts
await fetch("https://auth.example.com/api/auth/sign-in/email", {
  method: "POST",
  headers: { "content-type": "application/json" },
  credentials: "include",
  body: JSON.stringify({
    email: "alice@example.com",
    password: "strong-password",
  }),
});
```

Better Auth will set a session cookie. When the frontend and auth worker are on different origins, always use:

```ts
credentials: "include"
```

### Get Current Session

```ts
const res = await fetch("https://auth.example.com/api/session", {
  credentials: "include",
});

const session = await res.json();
```

Example response:

```json
{
  "authenticated": true,
  "session": {
    "user": {
      "id": "user-id",
      "email": "alice@example.com",
      "name": "Alice"
    }
  }
}
```

### Sign Out

```ts
await fetch("https://auth.example.com/api/auth/sign-out", {
  method: "POST",
  credentials: "include",
});
```

## JWT Usage

If another API or Worker needs Bearer-token auth, exchange the session cookie for a JWT:

```ts
const res = await fetch("https://auth.example.com/api/auth/token", {
  credentials: "include",
});

const { token } = await res.json();
```

Then call your API:

```ts
await fetch("https://api.example.com/api/protected", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

The auth worker exposes JWKS at:

```txt
https://auth.example.com/api/auth/jwks
```

Protected example routes in this Worker:

```txt
GET /api/protected/session
GET /api/protected/jwt
```

## OAuth Provider Usage

This Worker can act as an OAuth/OIDC provider for third-party clients.

Useful endpoints:

```txt
GET  /api/auth/oauth2/authorize
POST /api/auth/oauth2/token
POST /api/auth/oauth2/introspect
POST /api/auth/oauth2/revoke
GET  /api/auth/oauth2/userinfo
POST /api/auth/oauth2/register
GET  /.well-known/openid-configuration
GET  /.well-known/oauth-authorization-server
```

The OAuth consent page is:

```txt
/consent
```

That page is used when an OAuth client asks the user to approve access.

## Built-In Pages

The Worker includes minimal fallback pages:

```txt
/sign-in
/sign-up
/consent
```

These pages are optional.

Use them when:

- You want a quick login/register UI without building one in the app
- OAuth Provider flow needs a login or consent page
- You want a simple manual test surface

You can ignore `/sign-in` and `/sign-up` if your app has its own UI. In that case, call `/api/auth/*` directly from your app.

Keep `/consent` or replace it with your own consent UI if you use OAuth Provider flows.

## Social Login

Google and GitHub login are enabled only when both client ID and client secret are configured.

`wrangler.toml`:

```toml
[vars]
GOOGLE_CLIENT_ID = "..."
GITHUB_CLIENT_ID = "..."
```

Secrets:

```bash
pnpm --filter cloud-chief-auth-worker exec wrangler secret put GOOGLE_CLIENT_SECRET
pnpm --filter cloud-chief-auth-worker exec wrangler secret put GITHUB_CLIENT_SECRET
```

## Important Config

`BETTER_AUTH_URL` should be the public URL of this auth worker.

```toml
[vars]
BETTER_AUTH_URL = "https://auth.example.com"
FRONTEND_URL = "https://app.example.com"
TRUSTED_ORIGINS = "https://app.example.com,https://auth.example.com"
```

For local development:

```toml
BETTER_AUTH_URL = "http://localhost:8790"
FRONTEND_URL = "http://localhost:5173"
TRUSTED_ORIGINS = "http://localhost:5173,http://localhost:8790"
```

## Deploy

```bash
pnpm --filter cloud-chief-auth-worker run db:migrate:remote
pnpm --filter cloud-chief-auth-worker deploy
```

## File Layout

```txt
auth-worker/
  migrations/0001_better_auth.sql
  src/
    index.ts   # Worker entry
    app.ts     # Hono routes
    auth.ts    # Better Auth config, session, JWT middleware
    config.ts  # URL, origin, env helpers
    pages.ts   # fallback HTML pages
    http.ts    # response helpers
    types.ts   # shared types
```
