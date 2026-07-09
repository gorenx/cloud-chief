import { cfApi, cfApiWorkerSettingsPatch } from "./cf";
import { env } from "./env";
import {
  cfWorkersLastSyncedAt,
  getCfWorker,
  listCfWorkerDomains,
  listCfWorkers,
  upsertCfWorkerDomains,
  upsertCfWorker,
  upsertCfWorkers,
} from "./db/resource-store";
import {
  finishSyncRun,
  recordSyncEvent,
  startSyncRun,
  syncMeta,
  type SyncMeta,
} from "./db/sync-store";

export interface CfWorkerBinding {
  type?: string;
  name?: string;
  text?: string;
}

export interface CfWorkerResolveResult {
  ok: boolean;
  script_name: string;
  account_subdomain: string | null;
  subdomain_enabled: boolean;
  url: string | null;
  vars: Record<string, string>;
  secret_names: string[];
  error?: string;
}

export function parseBindings(bindings: unknown): {
  vars: Record<string, string>;
  secret_names: string[];
} {
  const vars: Record<string, string> = {};
  const secret_names: string[] = [];
  if (!Array.isArray(bindings)) return { vars, secret_names };

  for (const b of bindings as CfWorkerBinding[]) {
    if (!b?.name) continue;
    if (b.type === "plain_text" && typeof b.text === "string") {
      vars[b.name] = b.text;
    } else if (b.type === "secret_text") {
      secret_names.push(b.name);
    }
  }
  return { vars, secret_names };
}

export function buildWorkersDevUrl(
  scriptName: string,
  accountSubdomain: string | null,
  enabled: boolean,
): string | null {
  if (!enabled || !accountSubdomain || !scriptName) return null;
  return `https://${scriptName}.${accountSubdomain}.workers.dev`;
}

export interface CfDeployedWorker {
  name: string;
  url: string | null;
  subdomain_enabled: boolean;
  vars: Record<string, string>;
  secret_names: string[];
  compatibility_date: string | null;
  usage_model: string | null;
}

function normalizeScriptNames(result: unknown): string[] {
  if (!Array.isArray(result)) return [];
  return result
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "id" in item) {
        return String((item as { id: string }).id);
      }
      return null;
    })
    .filter((n): n is string => Boolean(n));
}

async function fetchAccountSubdomain(): Promise<string | null> {
  const subRes = await cfApi("GET", "/workers/subdomain");
  if (!subRes.json.success || typeof subRes.json.result !== "object" || !subRes.json.result) {
    return null;
  }
  return (subRes.json.result as { subdomain?: string }).subdomain ?? null;
}

async function fetchScriptDeployMeta(
  scriptName: string,
  accountSubdomain: string | null,
): Promise<CfDeployedWorker | null> {
  const [settingsRes, scriptSubRes] = await Promise.all([
    cfApi("GET", `/workers/scripts/${encodeURIComponent(scriptName)}/settings`),
    cfApi("GET", `/workers/scripts/${encodeURIComponent(scriptName)}/subdomain`),
  ]);
  if (!settingsRes.json.success) return null;

  const subdomainEnabled =
    scriptSubRes.json.success &&
    typeof scriptSubRes.json.result === "object" &&
    scriptSubRes.json.result !== null
      ? Boolean((scriptSubRes.json.result as { enabled?: boolean }).enabled)
      : false;

  const settings = settingsRes.json.result as {
    bindings?: unknown;
    compatibility_date?: string;
    usage_model?: string;
  } | undefined;
  const { vars, secret_names } = parseBindings(settings?.bindings);

  return {
    name: scriptName,
    url: buildWorkersDevUrl(scriptName, accountSubdomain, subdomainEnabled),
    subdomain_enabled: subdomainEnabled,
    vars,
    secret_names,
    compatibility_date: settings?.compatibility_date ?? null,
    usage_model: settings?.usage_model ?? null,
  };
}

/** 列出账号下已部署的 Worker 脚本（CF API） */
export async function listCfDeployedWorkers(
  hasApiToken: boolean,
  options: { refresh?: boolean } = {},
): Promise<{
  ok: boolean;
  account_subdomain: string | null;
  scripts: CfDeployedWorker[];
  error?: string;
  _sync?: SyncMeta;
}> {
  const accountId = env.CF_ACCOUNT_ID;
  const cached = listCfWorkers(accountId);
  const lastSyncedAt = cfWorkersLastSyncedAt(accountId);
  const ttlMs = 30_000;

  if (!hasApiToken) {
    return {
      ok: cached.length > 0,
      account_subdomain: null,
      scripts: cached,
      error: "未配置 CF_API_TOKEN",
      _sync: syncMeta({
        source: cached.length ? "local_snapshot" : "none",
        lastSyncedAt,
        ttlMs,
        error: "未配置 CF_API_TOKEN",
      }),
    };
  }

  if (
    !options.refresh &&
    !process.env.VITEST &&
    lastSyncedAt !== null &&
    Date.now() - lastSyncedAt <= ttlMs &&
    cached.length > 0
  ) {
    return {
      ok: true,
      account_subdomain: null,
      scripts: cached,
      _sync: syncMeta({ source: "local_snapshot", lastSyncedAt, ttlMs }),
    };
  }

  const runId = startSyncRun("cloudflare", "workers");
  const [accountSubdomain, listRes] = await Promise.all([
    fetchAccountSubdomain(),
    cfApi("GET", "/workers/scripts"),
  ]);

  if (!listRes.json.success) {
    const msg =
      (listRes.json.errors as Array<{ message?: string }> | undefined)?.[0]?.message ??
      `Worker 列表 HTTP ${listRes.status}`;
    recordSyncEvent({
      run_id: runId,
      resource_type: "cf_workers",
      resource_id: accountId,
      action: "refresh",
      status: "failed",
      message: msg,
    });
    finishSyncRun(runId, "failed", { error: msg });
    return {
      ok: cached.length > 0,
      account_subdomain: accountSubdomain,
      scripts: cached,
      error: msg,
      _sync: syncMeta({
        source: cached.length ? "local_snapshot" : "none",
        lastSyncedAt,
        ttlMs,
        error: msg,
        runId,
      }),
    };
  }

  const names = normalizeScriptNames(listRes.json.result);
  const settled = await Promise.all(
    names.map((name) => fetchScriptDeployMeta(name, accountSubdomain)),
  );
  const scripts = settled.filter((s): s is CfDeployedWorker => s !== null);
  upsertCfWorkers(accountId, scripts);
  recordSyncEvent({
    run_id: runId,
    resource_type: "cf_workers",
    resource_id: accountId,
    action: "refresh",
    status: "success",
    message: `${scripts.length} workers`,
  });
  finishSyncRun(runId, "success", { stats: { count: scripts.length } });

  return {
    ok: true,
    account_subdomain: accountSubdomain,
    scripts,
    _sync: syncMeta({
      source: "live",
      lastSyncedAt: Date.now(),
      ttlMs,
      runId,
    }),
  };
}

export function findCfWorkerByName(
  scripts: CfDeployedWorker[],
  scriptName: string | null,
): CfDeployedWorker | null {
  if (!scriptName) return null;
  return scripts.find((s) => s.name === scriptName) ?? null;
}

/** 列出绑定到指定 Worker 脚本的 Custom Domain 主机名 */
export async function listWorkerCustomDomains(
  scriptName: string,
  hasApiToken: boolean,
): Promise<{ ok: boolean; hostnames: string[]; error?: string }> {
  const cached = listCfWorkerDomains(env.CF_ACCOUNT_ID, scriptName);
  if (!hasApiToken) {
    return {
      ok: cached.length > 0,
      hostnames: cached,
      error: "未配置 CF_API_TOKEN",
    };
  }
  if (!scriptName) {
    return { ok: false, hostnames: [], error: "缺少 worker 脚本名" };
  }

  const res = await cfApi(
    "GET",
    `/workers/domains?service=${encodeURIComponent(scriptName)}`,
  );

  if (!res.json.success) {
    const msg =
      (res.json.errors as Array<{ message?: string }> | undefined)?.[0]?.message ??
      `Worker domains HTTP ${res.status}`;
    return { ok: cached.length > 0, hostnames: cached, error: msg };
  }

  const rows = Array.isArray(res.json.result) ? res.json.result : [];
  const hostnames = rows
    .map((row) => (row as { hostname?: string }).hostname)
    .filter((h): h is string => typeof h === "string" && h.length > 0);

  upsertCfWorkerDomains(env.CF_ACCOUNT_ID, scriptName, hostnames);
  return { ok: true, hostnames };
}

/** 从 Cloudflare API 解析已部署 Worker 的 workers.dev URL 与 [vars] 明文绑定 */
export async function resolveWorkerFromCf(
  scriptName: string,
  hasApiToken: boolean,
): Promise<CfWorkerResolveResult> {
  const cached = scriptName ? getCfWorker(env.CF_ACCOUNT_ID, scriptName) : null;
  const empty: CfWorkerResolveResult = {
    ok: false,
    script_name: scriptName,
    account_subdomain: null,
    subdomain_enabled: false,
    url: null,
    vars: {},
    secret_names: [],
  };

  if (!hasApiToken || !scriptName) {
    if (cached) {
      return {
        ok: true,
        script_name: cached.name,
        account_subdomain: null,
        subdomain_enabled: cached.subdomain_enabled,
        url: cached.url,
        vars: cached.vars,
        secret_names: cached.secret_names,
        error: hasApiToken ? "缺少 worker 脚本名" : "未配置 CF_API_TOKEN，使用本地 Worker 快照",
      };
    }
    return { ...empty, error: hasApiToken ? "缺少 worker 脚本名" : "未配置 CF_API_TOKEN" };
  }

  const [subRes, settingsRes, scriptSubRes] = await Promise.all([
    cfApi("GET", "/workers/subdomain"),
    cfApi("GET", `/workers/scripts/${encodeURIComponent(scriptName)}/settings`),
    cfApi("GET", `/workers/scripts/${encodeURIComponent(scriptName)}/subdomain`),
  ]);

  if (!settingsRes.json.success) {
    const msg =
      (settingsRes.json.errors as Array<{ message?: string }> | undefined)?.[0]?.message ??
      `Worker settings HTTP ${settingsRes.status}`;
    if (cached) {
      return {
        ok: true,
        script_name: cached.name,
        account_subdomain: null,
        subdomain_enabled: cached.subdomain_enabled,
        url: cached.url,
        vars: cached.vars,
        secret_names: cached.secret_names,
        error: `${msg}，使用本地 Worker 快照`,
      };
    }
    return { ...empty, error: msg };
  }

  const accountSubdomain =
    subRes.json.success && typeof subRes.json.result === "object" && subRes.json.result !== null
      ? ((subRes.json.result as { subdomain?: string }).subdomain ?? null)
      : null;

  const subdomainEnabled =
    scriptSubRes.json.success &&
    typeof scriptSubRes.json.result === "object" &&
    scriptSubRes.json.result !== null
      ? Boolean((scriptSubRes.json.result as { enabled?: boolean }).enabled)
      : false;

  const settings = settingsRes.json.result as { bindings?: unknown } | undefined;
  const { vars, secret_names } = parseBindings(settings?.bindings);

  const url = buildWorkersDevUrl(scriptName, accountSubdomain, subdomainEnabled);

  const resolved = {
    ok: true,
    script_name: scriptName,
    account_subdomain: accountSubdomain,
    subdomain_enabled: subdomainEnabled,
    url,
    vars,
    secret_names,
  };
  upsertCfWorker(env.CF_ACCOUNT_ID, {
    name: scriptName,
    url,
    subdomain_enabled: subdomainEnabled,
    vars,
    secret_names,
    compatibility_date: null,
    usage_model: null,
  });
  return resolved;
}

/** 合并 CF 部署 vars 与本地 wrangler.toml（CF 优先） */
export function mergeWorkerVars(
  cfVars: Record<string, string>,
  wranglerVars: Record<string, string>,
): { vars: Record<string, string>; source: "cf" | "wrangler" | "merged" } {
  if (Object.keys(cfVars).length === 0) {
    return { vars: { ...wranglerVars }, source: "wrangler" };
  }
  const merged = { ...wranglerVars, ...cfVars };
  const source =
    Object.keys(wranglerVars).length === 0
      ? "cf"
      : Object.keys(cfVars).some((k) => wranglerVars[k] !== cfVars[k])
        ? "merged"
        : "cf";
  return { vars: merged, source };
}

type CfSettingsBinding = Record<string, unknown> & {
  type?: string;
  name?: string;
  text?: string;
};

/** 用 wrangler [vars] 替换 plain_text 绑定，保留 secret / KV 等其它 binding */
export function buildBindingsWithPlainTextVars(
  existingBindings: unknown,
  vars: Record<string, string>,
): CfSettingsBinding[] {
  const keep = Array.isArray(existingBindings)
    ? (existingBindings as CfSettingsBinding[]).filter((b) => b?.type !== "plain_text")
    : [];
  const plain = Object.entries(vars).map(([name, text]) => ({
    type: "plain_text",
    name,
    text,
  }));
  return [...keep, ...plain];
}

export function diffWorkerVarKeys(
  localVars: Record<string, string>,
  cfVars: Record<string, string>,
): string[] {
  const changed: string[] = [];
  for (const [k, v] of Object.entries(localVars)) {
    if (cfVars[k] !== v) changed.push(k);
  }
  for (const k of Object.keys(cfVars)) {
    if (!(k in localVars)) changed.push(k);
  }
  return [...new Set(changed)];
}

/** 将 wrangler.toml [vars] 同步到 CF Worker settings（不重新上传脚本） */
export async function pushWorkerVarsToCf(
  scriptName: string,
  vars: Record<string, string>,
): Promise<{ ok: true; updated_keys: string[] } | { ok: false; error: string }> {
  if (!scriptName) return { ok: false, error: "缺少 worker 脚本名" };

  const settingsRes = await cfApi(
    "GET",
    `/workers/scripts/${encodeURIComponent(scriptName)}/settings`,
  );
  if (!settingsRes.json.success) {
    const msg =
      (settingsRes.json.errors as Array<{ message?: string }> | undefined)?.[0]?.message ??
      `Worker settings HTTP ${settingsRes.status}`;
    return { ok: false, error: msg };
  }

  const settings = settingsRes.json.result as {
    bindings?: unknown;
    compatibility_date?: string;
    usage_model?: string;
  };
  const prevVars = parseBindings(settings?.bindings).vars;
  const updated_keys = diffWorkerVarKeys(vars, prevVars);
  if (updated_keys.length === 0) {
    return { ok: true, updated_keys: [] };
  }

  const settingsPatch: Record<string, unknown> = {
    bindings: buildBindingsWithPlainTextVars(settings?.bindings, vars),
  };
  if (settings?.compatibility_date) settingsPatch.compatibility_date = settings.compatibility_date;
  if (settings?.usage_model) settingsPatch.usage_model = settings.usage_model;

  const patchRes = await cfApiWorkerSettingsPatch(scriptName, settingsPatch);
  if (!patchRes.json.success) {
    const msg =
      (patchRes.json.errors as Array<{ message?: string }> | undefined)?.[0]?.message ??
      `Worker settings PATCH HTTP ${patchRes.status}`;
    return { ok: false, error: msg };
  }

  return { ok: true, updated_keys };
}
