// Server-side quota + throttle for the AI gateway.
// Free-tier spend runs in Postgres (spend_free_ai_credit RPC, 0003 migration).

export { AiGatewayError } from "./errors.js";
export { utcPeriodKey } from "./period.js";
export { spendFreeAiCredit } from "./spend.js";
export type { SpendFreeResult } from "./types.js";
