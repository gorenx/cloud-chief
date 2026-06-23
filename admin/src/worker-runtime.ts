import { env, workerDir } from "./env";
import { resolveWorkerFromCf, mergeWorkerVars, listWorkerCustomDomains } from "./cf-worker-resolve";
import { resolveWorkerDirQuery } from "./worker-dir";
import { readWranglerToml } from "./wrangler-vars";
import {
  buildWorkerEndpointOptions,
  parseWorkerEndpoint,
  pickEndpointUrl,
  WORKER_ENDPOINT_LOCAL,
  type WorkerEndpointOption,
} from "./worker-endpoints";

export type WorkerConfigSource = "cf" | "env" | "wrangler" | "default";
/** Playground / API：local | workers_dev | custom:hostname（兼容 online → workers_dev） */
export type WorkerTarget = string;

export type { WorkerEndpointOption, WorkerEndpointKind } from "./worker-endpoints";
export { parseWorkerEndpoint, WORKER_ENDPOINT_LOCAL, WORKER_ENDPOINT_WORKERS_DEV } from "./worker-endpoints";

export interface WorkerRuntimeConfig {
  script_name: string | null;
  url: string;
  local_url: string;
  online_url: string | null;
  /** 至少有一个非 local 端点（workers.dev 或自定义域） */
  online_available: boolean;
  custom_domains: string[];
  url_endpoints: WorkerEndpointOption[];
  url_source: WorkerConfigSource;
  vars: Record<string, string>;
  vars_source: "cf" | "wrangler" | "merged";
  secret_names: string[];
  cf_error: string | null;
}

const CACHE_MS = 30_000;
let cache: { at: number; key: string; cfg: WorkerRuntimeConfig } | null = null;

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

function resolveRuntimeWorkerDir(dir?: string | null): string {
  if (!dir) return workerDir;
  return resolveWorkerDirQuery(dir) ?? workerDir;
}

function resolveLocalUrl(absDir: string): string {
  const envUrl = env.WORKER_URL?.trim().replace(/\/$/, "") ?? "";
  if (envUrl && isLoopbackWorkerUrl(envUrl)) return envUrl;
  const wrangler = readWranglerToml(absDir);
  const port = wrangler.dev_port ?? 8788;
  return `http://127.0.0.1:${port}`;
}

/** @deprecated 使用 parseWorkerEndpoint */
export function parseWorkerTarget(raw: string | null | undefined): WorkerTarget {
  return parseWorkerEndpoint(raw);
}

export function pickWorkerUrl(
  runtime: WorkerRuntimeConfig,
  endpointId: string,
): { url: string; error?: string } {
  return pickEndpointUrl(runtime.url_endpoints, runtime.local_url, endpointId);
}

export async function getWorkerRuntimeConfig(options?: {
  refresh?: boolean;
  /** 相对 WORKER_ROOT 的 worker 目录；空则用默认 workerDir */
  dir?: string | null;
}): Promise<WorkerRuntimeConfig> {
  const absDir = resolveRuntimeWorkerDir(options?.dir);
  const cacheKey = absDir;

  if (
    !options?.refresh &&
    cache &&
    cache.key === cacheKey &&
    Date.now() - cache.at < CACHE_MS
  ) {
    return cache.cfg;
  }

  const wrangler = readWranglerToml(absDir);
  const scriptName = wrangler.name ?? null;
  const hasToken = Boolean(env.CF_API_TOKEN);
  const cf = scriptName ? await resolveWorkerFromCf(scriptName, hasToken) : null;
  const domainsResult = scriptName
    ? await listWorkerCustomDomains(scriptName, hasToken)
    : { ok: false, hostnames: [] as string[], error: undefined };

  const { vars, source: vars_source } = mergeWorkerVars(cf?.vars ?? {}, wrangler.vars);

  const local_url = resolveLocalUrl(absDir);
  const online_url = cf?.ok && cf.url ? cf.url : null;
  const custom_domains = domainsResult.hostnames;
  const url_endpoints = buildWorkerEndpointOptions(local_url, online_url, custom_domains);
  const online_available = url_endpoints.some((e) => e.id !== WORKER_ENDPOINT_LOCAL);

  let url = local_url;
  let url_source: WorkerConfigSource = "default";
  const cf_error = cf?.error ?? domainsResult.error ?? null;

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
    custom_domains,
    url_endpoints,
    url_source,
    vars,
    vars_source,
    secret_names: cf?.secret_names ?? [],
    cf_error,
  };

  cache = { at: Date.now(), key: cacheKey, cfg };
  return cfg;
}

export function clearWorkerRuntimeCache(): void {
  cache = null;
}
