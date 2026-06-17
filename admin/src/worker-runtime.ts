import { env, workerDir } from "./env";
import { resolveWorkerFromCf, mergeWorkerVars } from "./cf-worker-resolve";
import { readWranglerToml } from "./wrangler-vars";

export type WorkerConfigSource = "cf" | "env" | "wrangler" | "default";

export interface WorkerRuntimeConfig {
  script_name: string | null;
  url: string;
  url_source: WorkerConfigSource;
  vars: Record<string, string>;
  vars_source: "cf" | "wrangler" | "merged";
  secret_names: string[];
  cf_error: string | null;
}

const CACHE_MS = 30_000;
let cache: { at: number; cfg: WorkerRuntimeConfig } | null = null;

function defaultLocalUrl(): string {
  return "http://127.0.0.1:8788";
}

function isLoopbackWorkerUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "127.0.0.1" || u.hostname === "localhost" || u.hostname === "[::1]";
  } catch {
    return false;
  }
}

function resolveScriptName(): string | null {
  const fromToml = readWranglerToml(workerDir).name;
  return fromToml ?? null;
}

export async function getWorkerRuntimeConfig(options?: {
  refresh?: boolean;
}): Promise<WorkerRuntimeConfig> {
  if (!options?.refresh && cache && Date.now() - cache.at < CACHE_MS) {
    return cache.cfg;
  }

  const scriptName = resolveScriptName();
  const wrangler = readWranglerToml(workerDir);
  const cf = scriptName
    ? await resolveWorkerFromCf(scriptName, Boolean(env.CF_API_TOKEN))
    : null;

  const { vars, source: vars_source } = mergeWorkerVars(cf?.vars ?? {}, wrangler.vars);

  let url = defaultLocalUrl();
  let url_source: WorkerConfigSource = "default";
  let cf_error = cf?.error ?? null;

  const envUrl = env.WORKER_URL?.trim().replace(/\/$/, "") ?? "";

  if (envUrl && isLoopbackWorkerUrl(envUrl)) {
    url = envUrl;
    url_source = "env";
  } else if (cf?.ok && cf.url) {
    url = cf.url;
    url_source = "cf";
  } else if (envUrl) {
    url = envUrl;
    url_source = "env";
  }

  const cfg: WorkerRuntimeConfig = {
    script_name: scriptName,
    url,
    url_source,
    vars,
    vars_source,
    secret_names: cf?.secret_names ?? [],
    cf_error,
  };

  cache = { at: Date.now(), cfg };
  return cfg;
}

export function clearWorkerRuntimeCache(): void {
  cache = null;
}
