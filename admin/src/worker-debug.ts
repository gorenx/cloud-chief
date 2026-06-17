import { env } from "./env";
import type { WorkerRuntimeConfig } from "./worker-runtime";

export interface WorkerDebugInfo {
  url: string;
  url_source: "cf" | "env" | "wrangler" | "default";
  worker_name: string | null;
  supabase_url: string | null;
  default_model: string | null;
  vars_source: "cf" | "wrangler" | "merged";
  secret_names: string[];
  cf_error: string | null;
  has_test_credentials: boolean;
  endpoints: ["/v1/responses", "/v1/chat/completions"];
}

export function buildWorkerDebugInfo(runtime: WorkerRuntimeConfig): WorkerDebugInfo {
  return {
    url: runtime.url,
    url_source: runtime.url_source,
    worker_name: runtime.script_name,
    supabase_url: runtime.vars.SUPABASE_URL ?? null,
    default_model: runtime.vars.DEFAULT_MODEL ?? null,
    vars_source: runtime.vars_source,
    secret_names: runtime.secret_names,
    cf_error: runtime.cf_error,
    has_test_credentials: Boolean(
      env.SUPABASE_ANON_KEY && env.SUPABASE_TEST_EMAIL && env.SUPABASE_TEST_PASSWORD,
    ),
    endpoints: ["/v1/responses", "/v1/chat/completions"],
  };
}
