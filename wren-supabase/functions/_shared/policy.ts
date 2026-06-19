// AI policy the gateway enforces. These are the SERVER's own numbers — the
// client never dictates them. Some mirror Dart constants across the language
// boundary (the one place "single source" can't be literally enforced); keep
// them in sync by hand when the Dart side changes:
//
//   FREE_MODEL / PLUS_MODEL  ↔  lib/domain/constants.dart WrenRules.aiModelFree
//                               / aiModelPlus
//   PLUS_ENTITLEMENT_ID       ↔  lib/domain/constants.dart WrenRules.proEntitlementId
//
// FREE_DAILY_CEILING is intentionally DECOUPLED from the client's
// WrenRules.freeAiQuota (=3). That 3 is the UX paywall threshold (a product
// lever). This ceiling is the cost guardrail: comfortably above real free usage
// (~3 interactive + 1 daily step + 1 weekly note) so honest users never hit it,
// while a tampered/abusive client is pinned here. See
// docs/server-authoritative-ai.md §5.1.

export const FREE_MODEL = "claude-haiku-4-5";
export const PLUS_MODEL = "claude-opus-4-8";
export const PLUS_ENTITLEMENT_ID = "wren Pro";

/// per-user daily ceiling for free, authenticated users (all gateway calls).
export const FREE_DAILY_CEILING = 8;

/// server-fixed per-call token budget — the client cannot inflate cost.
export const MAX_TOKENS = 1024;

/// reject absurdly large prompts before they ever reach Anthropic.
export const MAX_PROMPT_CHARS = 100_000;

/// Sybil defense-in-depth (generous, to avoid throttling shared NAT / family
/// devices). Both signals are client-influenced, so these only deter casual
/// multi-account abuse — they are not a hard gate.
export const DEVICE_DAILY_CAP = 16; // one device, across any accounts
export const IP_DAILY_CAP = 64; // one IP/day — generous for shared NAT
