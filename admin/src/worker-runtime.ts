import { env, workerDir } from "./env";
import { resolveWorkerFromCf, mergeWorkerVars } from "./cf-worker-resolve";
import { readWranglerToml } from "./wrangler-vars";

export type WorkerConfigSource = "cf" | "env" | "wrangler" | "default";
export type WorkerTarget = "local" | "online";

export interface WorkerRuntimeConfig {
  script_name: string | null;
  url: string;
  local_url: string;
  online_url: string | null;
  online_available: boolean;
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

function resolveLocalUrl(): string {
  const envUrl = env.WORKER_URL?.trim().replace(/\/$/, "") ?? "";
  if (envUrl && isLoopbackWorkerUrl(envUrl)) return envUrl;
  return defaultLocalUrl();
}

export function parseWorkerTarget(raw: string | null | undefined): WorkerTarget {
  return raw === "online" ? "online" : "local";
}

export function pickWorkerUrl(
  runtime: WorkerRuntimeConfig,
  target: WorkerTarget,
): { url: string; error?: string } {
  if (target === "online") {
    if (!runtime.online_url) {
      return {
        url: runtime.local_url,
        error: "未解析到线上 Worker（需 CF_API_TOKEN 且已部署并启用 workers.dev）",
      };
    }
    return { url: runtime.online_url };
  }
  return { url: runtime.local_url };
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

  const local_url = resolveLocalUrl();
  const online_url = cf?.ok && cf.url ? cf.url : null;
  const online_available = Boolean(online_url);

  let url = local_url;
  let url_source: WorkerConfigSource = "default";
  let cf_error = cf?.error ?? null;

  const envUrl = env.WORKER_URL?.trim().replace(/\/$/, "") ?? "";

  if (envUrl && isLoopbackWorkerUrl(envUrl)) {
    url = local_url;
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
    local_url,
    online_url,
    online_available,
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
