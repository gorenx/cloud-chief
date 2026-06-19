# Wren Supabase schema — migrations + local pgTAP tests.
#
# Remote:  supabase login (once) + PROJECT_REF=<ref>
# Local:   Docker running for `make dev` / `make test`
#
# AI gateway and billing deploy separately:
#   ai-gateway-worker/   — JWT + quota + AI proxy
#   worker-revenuecat/   — webhook, sync-entitlement, RC read API
#
# Usage:  make -C wren-supabase help
#         make -C wren-supabase release PROJECT_REF=abcd1234

SHELL := /bin/bash
PROJECT_REF ?=

MAKEFLAGS += --no-print-directory
.DEFAULT_GOAL := help

define need_cli
	@command -v supabase >/dev/null 2>&1 || { \
	  echo "✗ supabase CLI not found. Install: brew install supabase/tap/supabase"; \
	  exit 1; }
endef

define need_ref
	@[ -n "$(PROJECT_REF)" ] || { \
	  echo "✗ PROJECT_REF is required, e.g. make release PROJECT_REF=abcd1234"; exit 1; }
endef

.PHONY: help
help:
	@echo "Wren Supabase targets (run as: make -C wren-supabase <target>)"
	@echo ""
	@echo "  Remote (needs 'supabase login' + PROJECT_REF):"
	@echo "    link      — link this repo to your Supabase project"
	@echo "    db-push   — apply migrations/ (tables + RLS)"
	@echo "    release   — link + db-push"
	@echo ""
	@echo "  Local (needs Docker):"
	@echo "    dev       — supabase start + db reset"
	@echo "    test      — pgTAP RLS tests in tests/"
	@echo "    stop      — stop local stack"

.PHONY: link
link:
	$(call need_cli)
	$(call need_ref)
	supabase link --project-ref $(PROJECT_REF)

.PHONY: db-push
db-push:
	$(call need_cli)
	supabase db push

.PHONY: release
release: link db-push
	@echo ""
	@echo "✓ Schema live. Deploy Workers next:"
	@echo "  ai-gateway-worker/   wrangler deploy + SUPABASE_SERVICE_ROLE_KEY secret"
	@echo "  worker-revenuecat/   wrangler deploy + RC + service role secrets"

.PHONY: dev
dev:
	$(call need_cli)
	supabase start
	supabase db reset

.PHONY: test
test:
	$(call need_cli)
	supabase test db

.PHONY: stop
stop:
	$(call need_cli)
	supabase stop
