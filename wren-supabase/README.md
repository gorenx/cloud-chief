# supabase/ — backend for cloud sync + the server-authoritative AI gateway

> Why this exists: see `../docs/server-authoritative-ai.md`. In short — the
> Anthropic key must NOT live in the app binary, and the free quota / Plus flag
> must be decided by a server, not the client. This directory holds the SQL and
> the Edge Functions that do that. The Flutter client talks to `wren-voice`
> instead of `api.anthropic.com`.

## Layout

```
migrations/0001_wren_state.sql            # per-user sync document (RemoteStore) + RLS + realtime
migrations/0002_ai_gateway.sql            # user_entitlements + ai_usage + ai_throttle (tables + RLS)
functions/wren-voice/             # JWT-gated Anthropic proxy (quota + model decided here)
functions/sync-entitlement/       # JWT-gated RC REST mirror (webhook gap reconciliation)
functions/revenuecat-webhook/     # writes server-authoritative Plus from RevenueCat events
functions/_shared/                # policy, CORS, ai_gateway, revenuecat_entitlement
config.toml                       # per-function verify_jwt
.env.example                      # the function secrets to set
```

## Deploy (order matters)

One command does steps 1–3 (after a one-time `supabase login`):

```bash
supabase login                                    # once, interactive
make -C supabase release PROJECT_REF=<your-ref>   # link + db-push + secrets + deploy
make -C supabase print-webhook PROJECT_REF=<your-ref>   # step 4: the URL to paste
```

Or run the steps by hand:

```bash
supabase link --project-ref <your-ref>            # 0
supabase db push                                  # 1  schema: tables + RLS
supabase secrets set --env-file supabase/.env     # 2  function secrets (.env.example)
supabase functions deploy wren-voice              # 3
supabase functions deploy sync-entitlement        # 3
supabase functions deploy revenuecat-webhook      # 3
```

Then in the RevenueCat dashboard → **Webhooks**: point a webhook at
`https://<ref>.functions.supabase.co/revenuecat-webhook`, and set its
Authorization header to `Bearer <REVENUECAT_WEBHOOK_SECRET>` (the same value you
set in step 2). Also set `REVENUECAT_REST_API_KEY` from RevenueCat Project
Settings → API Keys so the webhook can mirror the current `wren Pro`
entitlement via `GET /subscribers/<uid>` and safely process `TRANSFER` events.

### Rollout order (important)

The gateway reads Plus from `user_entitlements`, which is populated by the
webhook and by `sync-entitlement` (the app calls the latter after login /
purchase / restore when RevenueCat reports a change). **Deploy the webhook and
bind RevenueCat's `app_user_id` to the Supabase uid (the app does this via
`Purchases.logIn` on sign-in) BEFORE relying on server entitlement.** Until a
user's row exists, the gateway treats them as free (Haiku, under the daily
ceiling) even if they paid — so don't flip the app to the Edge transport in
production until the entitlement path is live. Set `REVENUECAT_REST_API_KEY`
for both webhook and sync-entitlement (required for sync).

## Test the server-side enforcement

The RLS policies are covered by pgTAP integration tests in `tests/`. Quota/throttle
validation is covered by Deno specs in `functions/_shared/ai_gateway_test.ts`.
They run against a local stack (needs Docker for pgTAP):

```bash
make -C supabase dev     # supabase start + db reset (applies migrations)
make -C supabase test    # supabase test db → runs tests/ai_gateway_test.sql
deno test --allow-read supabase/functions/_shared/ai_gateway_test.ts
```

The tests assert: authenticated clients can read but never write
`user_entitlements` / `ai_usage` / `ai_throttle`; the gateway module rejects
malformed inputs before touching the database.

## How the gateway protects you

| Concern | Mechanism |
|---|---|
| Key leakage | `ANTHROPIC_API_KEY` is a function secret; never shipped to the client |
| Unlimited calls | `consumeAiCredit` optimistic-lock per-user daily ceiling (`FREE_DAILY_CEILING`) |
| Forged Plus | tier read from `user_entitlements` (only the service-role webhook writes it; webhook mirrors RevenueCat's `wren Pro` entitlement when `REVENUECAT_REST_API_KEY` is set) |
| Cost per call | `max_tokens` + model fixed server-side; prompt length bounded |
| Sybil (many accounts) | `bumpThrottle` per-device + per-IP daily soft caps |

## Client config switch

The app picks the Edge transport automatically when a Supabase backend is
configured (`SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` via `--dart-define`).
Legacy `SUPABASE_ANON_KEY` is still accepted as a fallback (resolved in
`lib/app/wren_compile_config.dart`). To run the app against the gateway:

```bash
flutter run -d macos \
  --dart-define=SUPABASE_URL=https://xxxx.supabase.co \
  --dart-define=SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx \
  --dart-define=SUPABASE_OAUTH_PROVIDERS=apple,google
# NOTE: do NOT pass ANTHROPIC_API_KEY for a shipping build — that is the dev-only
# DirectAnthropicTransport path and would bake the key into the binary.
```

`--dart-define=ANTHROPIC_API_KEY=...` still works for **local dev without a
backend** (DirectAnthropicTransport → talks to Anthropic directly). It must
never be set on a build you distribute.

## Auth providers (Apple / Google OAuth)

Enable **Apple** and **Google** providers in the Supabase dashboard (keep
**Anonymous** off — the app uses real accounts only).

The client only shows OAuth buttons explicitly listed in
`SUPABASE_OAUTH_PROVIDERS` (`apple`, `google`, comma-separated). Omit it or set
it empty to hide and disable both Apple and Google sign-in.

Redirect deep-link: `SUPABASE_OAUTH_REDIRECT` (default
`com.angoren.wren://login-callback`). Register the URL scheme per platform and add it
to **Auth → URL Configuration → Redirect URLs**:

- **iOS / macOS** — `Info.plist` `CFBundleURLTypes` includes the scheme; Apple
  also needs Sign in with Apple configured in Apple Developer and the Apple
  provider enabled in Supabase (client id / secret).
- **Android** — `AndroidManifest.xml` deep-link `intent-filter` (the
  supabase_flutter callback activity).
- **Google** — enable the Google provider in Supabase with its OAuth client
  id / secret.

App Store review requires native Sign in with Apple on iOS. For a better
experience the OAuth providers can later be swapped to native
`sign_in_with_apple` / `google_sign_in` + `signInWithIdToken` — that touches
only `lib/data/sync/supabase_auth.dart`; the ports and everything else are
unchanged.

## Email auth (sign-in codes + optional password)

The app's email door is **code-first**: `signInWithOtp` mails a 6-digit code,
verified with `OtpType.email`. Passwords are optional (set after a code
verify, or under You → Set a password, via `updateUser`). Dashboard
requirements:

- **Email provider on**, with **Confirm email** enabled — password sign-ups
  (if ever re-enabled) and legacy unconfirmed accounts verify with
  `OtpType.signup` codes.
- **Email templates must mail the code, not just a link**: put `{{ .Token }}`
  in the **Magic Link** template (used for sign-in codes) and keep it in
  **Confirm signup**. Without it users receive a link the app never handles.
- **No auto-created users**: the client requests sign-in codes with
  `shouldCreateUser: false`, so an unknown email gets `otp_disabled`
  ("Signups not allowed for otp") — that error is expected and drives the
  app's explicit create path (which passes the first name and
  `shouldCreateUser: true`).
- Mind **Auth rate limits** (emails per hour); the app spaces resends with its
  own cooldown but the project-level limit still applies.
- The app maintains a `has_password` flag in user metadata (set on
  `updateUser(password:)`) purely as a UX hint for the "Add a password?"
  offer; password correctness is always enforced by GoTrue itself.

## Device E2E (real Supabase + OAuth deep link)

Widget specs in `test/` stay fast and offline — no Supabase dart-defines. **Cloud
auth is exercised on a real device** via `integration_test/` with the same
`WrenRoot()` production wiring:

```bash
cp dart_defines.e2e.example.json dart_defines.e2e.json   # fill in project + test account
./scripts/run_e2e.sh <device_id>                          # iOS simulator / Android / physical
```

`dart_defines.e2e.json` is gitignored. Required keys:

| Key | Purpose |
|---|---|
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` | Real project — Supabase SDK boots on device |
| `SUPABASE_OAUTH_PROVIDERS` | Must list the provider you will tap |
| `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` | Dedicated test user for automated email sign-in |
| `E2E_OAUTH_PROVIDER` | `google` or `apple` for the manual browser OAuth spec |

Optional keys like `WREN_MODEL` should normally stay empty; set `WREN_MODEL`
only when you intentionally want every tier to use one specific AI model during
dev / CI verification.

Specs:

- `integration_test/email_cloud_auth_e2e_test.dart` — fully automated email login
- `integration_test/oauth_deep_link_e2e_test.dart` — tap provider, complete sign-in
  in the system browser, assert the deep link returns through the gate

Before re-running, clear app data or sign out if a previous session is cached.
