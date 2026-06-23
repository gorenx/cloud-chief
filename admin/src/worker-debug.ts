import { env } from "./env";
import type { WorkerRuntimeConfig } from "./worker-runtime";
import type { WorkerEndpointOption } from "./worker-endpoints";
import {
  detectWorkerCapabilities,
  inferWorkerEndpoints,
  type WorkerCapabilities,
} from "./worker-capabilities";

export interface WorkerDebugInfo {
  capabilities: WorkerCapabilities;
  url: string;
  local_url: string;
  online_url: string | null;
  online_available: boolean;
  custom_domains: string[];
  url_endpoints: WorkerEndpointOption[];
  url_source: "cf" | "env" | "wrangler" | "default";
  worker_name: string | null;
  supabase_url: string | null;
  default_model: string | null;
  vars_source: "cf" | "wrangler" | "merged";
  secret_names: string[];
  cf_error: string | null;
  has_anon_key: boolean;
  has_test_credentials: boolean;
  endpoints: readonly string[];
}

export function buildWorkerDebugInfo(runtime: WorkerRuntimeConfig): WorkerDebugInfo {
  const capabilities = detectWorkerCapabilities(runtime.vars);
  return {
    capabilities,
    url: runtime.url,
    local_url: runtime.local_url,
    online_url: runtime.online_url,
    online_available: runtime.online_available,
    custom_domains: runtime.custom_domains,
    url_endpoints: runtime.url_endpoints,
    url_source: runtime.url_source,
    worker_name: runtime.script_name,
    supabase_url: runtime.vars.SUPABASE_URL ?? null,
    default_model: runtime.vars.DEFAULT_MODEL ?? null,
    vars_source: runtime.vars_source,
    secret_names: runtime.secret_names,
    cf_error: runtime.cf_error,
    has_anon_key: Boolean(env.SUPABASE_ANON_KEY),
    has_test_credentials: Boolean(
      env.SUPABASE_ANON_KEY && env.SUPABASE_TEST_EMAIL && env.SUPABASE_TEST_PASSWORD,
    ),
    endpoints: inferWorkerEndpoints(capabilities),
  };
}
