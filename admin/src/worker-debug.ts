import { env, workerDir } from "./env";
import { readWranglerToml } from "./wrangler-vars";

export interface WorkerDebugInfo {
  url: string;
  worker_name: string | null;
  supabase_url: string | null;
  default_model: string | null;
  has_test_credentials: boolean;
  endpoints: ["/v1/responses", "/v1/chat/completions"];
}

export function buildWorkerDebugInfo(): WorkerDebugInfo {
  const { name, vars } = readWranglerToml(workerDir);
  return {
    url: env.WORKER_URL,
    worker_name: name,
    supabase_url: vars.SUPABASE_URL ?? null,
    default_model: vars.DEFAULT_MODEL ?? null,
    has_test_credentials: Boolean(
      env.SUPABASE_ANON_KEY && env.SUPABASE_TEST_EMAIL && env.SUPABASE_TEST_PASSWORD,
    ),
    endpoints: ["/v1/responses", "/v1/chat/completions"],
  };
}
