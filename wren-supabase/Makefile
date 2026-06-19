# Wren backend — one-command deploy + local tests.
#
# These wrap the 5 rollout steps from docs/server-authoritative-ai.md so they're
# trivial to run. The remote-mutating targets need YOUR credentials:
#   - `supabase login` once (interactive, opens a browser)
#   - PROJECT_REF=<your-ref>  (Supabase dashboard → Project Settings → General)
#   - secrets filled into supabase/.env  (copy from .env.example)
#
# Usage:  make -C supabase help
#         make -C supabase release PROJECT_REF=abcd1234
#         make -C supabase dev && make -C supabase test     # local, needs Docker

SHELL := /bin/bash
ENV_FILE ?= .env
PROJECT_REF ?=

# every target runs from this directory
MAKEFLAGS += --no-print-directory

.DEFAULT_GOAL := help

# fail early with a friendly message if the CLI is missing
define need_cli
	@command -v supabase >/dev/null 2>&1 || { \
	  echo "✗ supabase CLI not found. Install: brew install supabase/tap/supabase"; \
	  echo "  (docs: https://supabase.com/docs/guides/cli)"; exit 1; }
endef

define need_ref
	@[ -n "$(PROJECT_REF)" ] || { \
	  echo "✗ PROJECT_REF is required, e.g. make release PROJECT_REF=abcd1234"; exit 1; }
endef

.PHONY: help
help:
	@echo "Wren backend targets (run as: make -C supabase <target>)"
	@echo ""
	@echo "  Remote (needs 'supabase login' + PROJECT_REF + .env):"
	@echo "    link        — link this repo to your Supabase project   [step 0]"
	@echo "    db-push     — apply migrations (tables + RLS)            [step 1]"
	@echo "    secrets     — push function secrets from $(ENV_FILE)        [step 2]"
    @echo "    deploy      — deploy wren-voice + sync-entitlement + revenuecat-webhook [step 3]"
	@echo "    release     — link + db-push + secrets + deploy          [steps 1-3]"
	@echo "    print-webhook — the RevenueCat webhook URL to paste      [step 4]"
	@echo "    build-macos — flutter release build wired to the gateway [step 5]"
	@echo ""
	@echo "  Local (needs Docker running):"
	@echo "    dev         — supabase start + db reset (apply migrations locally)"
	@echo "    test        — run the pgTAP RLS integration tests"
	@echo "    serve       — serve the Edge Functions locally from $(ENV_FILE)"
	@echo "    stop        — stop the local stack"

# ---- remote (your credentials) ------------------------------------------------

.PHONY: link
link:
	$(call need_cli)
	$(call need_ref)
	supabase link --project-ref $(PROJECT_REF)

.PHONY: db-push
db-push:
	$(call need_cli)
	supabase db push

.PHONY: secrets
secrets:
	$(call need_cli)
	@[ -f "$(ENV_FILE)" ] || { echo "✗ $(ENV_FILE) not found — copy .env.example and fill it"; exit 1; }
	supabase secrets set --env-file $(ENV_FILE)

.PHONY: deploy
deploy:
	$(call need_cli)
supabase functions deploy wren-voice
supabase functions deploy sync-entitlement
supabase functions deploy revenuecat-webhook

# steps 1-3 in the correct order, one command
.PHONY: release
release: link db-push secrets deploy
	@echo ""
	@echo "✓ schema + secrets + functions live."
	@echo "  Next: 'make print-webhook' (step 4), then 'make build-macos ...' (step 5)."

.PHONY: print-webhook
print-webhook:
	$(call need_ref)
	@echo "RevenueCat dashboard → Project → Webhooks → add:"
	@echo "  URL:  https://$(PROJECT_REF).functions.supabase.co/revenuecat-webhook"
	@echo "  Auth header:  Bearer <REVENUECAT_WEBHOOK_SECRET>  (same value as in $(ENV_FILE))"

# step 5: a release build wired to the Edge gateway. Refuses to bake an Anthropic
# key (that is the dev-only path and would leak the key into the binary).
.PHONY: build-macos
build-macos:
	@[ -n "$(SUPABASE_URL)" ] && [ -n "$(SUPABASE_PUBLISHABLE_KEY)" ] || { \
	  echo "✗ pass SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=..."; exit 1; }
	@[ -z "$(ANTHROPIC_API_KEY)" ] || { \
	  echo "✗ refusing: ANTHROPIC_API_KEY must NOT be in a shipping build (it'd be extractable)"; exit 1; }
	cd .. && flutter build macos --release \
	  --dart-define=SUPABASE_URL=$(SUPABASE_URL) \
	  --dart-define=SUPABASE_PUBLISHABLE_KEY=$(SUPABASE_PUBLISHABLE_KEY)

# ---- local (Docker) -----------------------------------------------------------

.PHONY: dev
dev:
	$(call need_cli)
	supabase start
	supabase db reset   # applies migrations/*.sql into the local db

.PHONY: test
test:
	$(call need_cli)
	supabase test db

.PHONY: serve
serve:
	$(call need_cli)
	supabase functions serve --env-file $(ENV_FILE)

.PHONY: stop
stop:
	$(call need_cli)
	supabase stop
