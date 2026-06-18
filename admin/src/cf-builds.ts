import fs from "node:fs";
import path from "node:path";
import { env } from "./env";

export interface CloudflareBuildsConfig {
  worker_name: string;
  root_directory: string;
  build_command: string;
  deploy_command: string;
  preview_deploy_command: string;
  path_includes: string[];
  path_excludes: string[];
}

export interface BuildRepoConnection {
  repo_name: string | null;
  provider_account_name: string | null;
  provider_type: string | null;
}

export interface BuildTriggerInfo {
  trigger_uuid: string;
  trigger_name: string;
  build_command: string;
  deploy_command: string;
  root_directory: string;
  branch_includes: string[];
  branch_excludes: string[];
  path_includes: string[];
  path_excludes: string[];
  is_preview: boolean;
  repo: BuildRepoConnection | null;
}

export interface BuildSummary {
  build_uuid: string;
  build_outcome: string | null;
  created_on: string | null;
  branch: string | null;
  commit_hash: string | null;
}

export interface WorkerBuildsStatus {
  ok: boolean;
  error?: string;
  token_configured: boolean;
  account_id: string;
  wrangler_name: string | null;
  config: CloudflareBuildsConfig | null;
  worker_tag: string | null;
  cf_script_name: string | null;
  name_mismatch: boolean;
  dashboard_builds_url: string | null;
  triggers: BuildTriggerInfo[];
  recent_builds: BuildSummary[];
  /** CF_WORKER_BUILDER 已配置但 Cloudflare 返回 Invalid token 等鉴权错误 */
  token_invalid?: boolean;
}

interface CfBuildsJson {
  success?: boolean;
  result?: unknown;
  errors?: Array<{ message?: string; code?: number }>;
}

function buildsApiToken(): string {
  return env.CF_WORKER_BUILDER.trim();
}

function scriptLookupTokens(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [
    env.CF_WORKER_BUILDER.trim(),
    env.CLOUDFLARE_API_TOKEN.trim(),
    env.CF_API_TOKEN.trim(),
  ]) {
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function cfBuildsBase(): string {
  return `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}`;
}

export function formatBuilderTokenError(json: CfBuildsJson, status: number): string {
  const msg = json.errors?.[0]?.message?.trim() ?? "";
  if (/invalid token|authentication error/i.test(msg)) {
    return [
      "Authentication error：Workers Builds 只接受用户级 API Token。",
      "请到 My Profile → API Tokens（不是 Account API Tokens）创建，",
      `权限选 Account「${env.CF_ACCOUNT_ID}」→ Workers CI Edit + Workers Scripts Read。`,
    ].join("");
  }
  if (msg) return msg;
  if (status === 403 || status === 401) {
    return "Builds API 鉴权失败：请使用用户级 API Token（Workers CI Edit + Workers Scripts Read）";
  }
  return `Builds API HTTP ${status}`;
}

export function isBuilderTokenInvalidMessage(error?: string): boolean {
  if (!error) return false;
  return (
    /invalid token/i.test(error) ||
    /authentication error/i.test(error) ||
    /鉴权失败/i.test(error) ||
    /只接受用户级/i.test(error) ||
    /unauthorized/i.test(error)
  );
}

function buildsStatusError(base: WorkerBuildsStatus, error: string): WorkerBuildsStatus {
  return { ...base, error, token_invalid: isBuilderTokenInvalidMessage(error) };
}

function cfBuildsError(json: CfBuildsJson, status: number): string {
  return formatBuilderTokenError(json, status);
}

async function cfAccountApi(
  method: string,
  apiPath: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; json: CfBuildsJson }> {
  try {
    const r = await fetch(cfBuildsBase() + apiPath, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let json: CfBuildsJson;
    try {
      json = JSON.parse(text) as CfBuildsJson;
    } catch {
      json = { success: false, errors: [{ message: text.slice(0, 200) || `HTTP ${r.status}` }] };
    }
    return { status: r.status, json };
  } catch (e) {
    return {
      status: 0,
      json: { success: false, errors: [{ message: (e as Error).message }] },
    };
  }
}

export async function cfBuildsApi(
  method: string,
  apiPath: string,
  body?: unknown,
  tokenOverride?: string,
): Promise<{ status: number; json: CfBuildsJson }> {
  const token = (tokenOverride ?? buildsApiToken()).trim();
  if (!token) {
    return {
      status: 0,
      json: { success: false, errors: [{ message: "未配置 CF_WORKER_BUILDER" }] },
    };
  }
  return cfAccountApi(method, apiPath, token, body);
}

/** 保存前校验：仅 Builds API 接受该用户 Token。 */
export async function validateWorkerBuilderToken(
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = token.trim();
  if (!trimmed) return { ok: false, error: "请填写 API Token" };

  const probes = [
    cfAccountApi("GET", "/builds/tokens", trimmed),
    cfAccountApi("GET", "/workers/scripts", trimmed),
  ];
  const results = await Promise.all(probes);
  const buildsOk = results[0].json.success;
  const scriptsOk = results[1].json.success;

  if (buildsOk || scriptsOk) return { ok: true };

  const buildsErr = formatBuilderTokenError(results[0].json, results[0].status);
  const scriptsErr = formatBuilderTokenError(results[1].json, results[1].status);
  if (buildsErr === scriptsErr) return { ok: false, error: buildsErr };
  return { ok: false, error: `${buildsErr}（Workers Scripts：${scriptsErr}）` };
}

export function readCloudflareBuildsConfig(workerDir: string): CloudflareBuildsConfig | null {
  const file = path.join(workerDir, "cloudflare-builds.json");
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<CloudflareBuildsConfig>;
    if (
      typeof raw.worker_name !== "string" ||
      typeof raw.root_directory !== "string" ||
      typeof raw.build_command !== "string" ||
      typeof raw.deploy_command !== "string" ||
      typeof raw.preview_deploy_command !== "string" ||
      !Array.isArray(raw.path_includes) ||
      !Array.isArray(raw.path_excludes)
    ) {
      return null;
    }
    return raw as CloudflareBuildsConfig;
  } catch {
    return null;
  }
}

export function buildDashboardBuildsUrl(accountId: string, scriptName: string): string {
  return `https://dash.cloudflare.com/${accountId}/workers/services/view/${encodeURIComponent(scriptName)}/production/settings/builds`;
}

export function isPreviewTrigger(trigger: {
  branch_includes?: string[];
  branch_excludes?: string[];
}): boolean {
  const includes = trigger.branch_includes ?? [];
  const excludes = trigger.branch_excludes ?? [];
  return includes.includes("*") && excludes.includes("main");
}

function parseRepoConnection(raw: unknown): BuildRepoConnection | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    repo_name: typeof r.repo_name === "string" ? r.repo_name : null,
    provider_account_name: typeof r.provider_account_name === "string" ? r.provider_account_name : null,
    provider_type: typeof r.provider_type === "string" ? r.provider_type : null,
  };
}

function parseTrigger(raw: unknown): BuildTriggerInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.trigger_uuid !== "string") return null;
  const branch_includes = Array.isArray(t.branch_includes)
    ? t.branch_includes.filter((x): x is string => typeof x === "string")
    : [];
  const branch_excludes = Array.isArray(t.branch_excludes)
    ? t.branch_excludes.filter((x): x is string => typeof x === "string")
    : [];
  const path_includes = Array.isArray(t.path_includes)
    ? t.path_includes.filter((x): x is string => typeof x === "string")
    : [];
  const path_excludes = Array.isArray(t.path_excludes)
    ? t.path_excludes.filter((x): x is string => typeof x === "string")
    : [];
  return {
    trigger_uuid: t.trigger_uuid,
    trigger_name: typeof t.trigger_name === "string" ? t.trigger_name : t.trigger_uuid,
    build_command: typeof t.build_command === "string" ? t.build_command : "",
    deploy_command: typeof t.deploy_command === "string" ? t.deploy_command : "",
    root_directory: typeof t.root_directory === "string" ? t.root_directory : "",
    branch_includes,
    branch_excludes,
    path_includes,
    path_excludes,
    is_preview: isPreviewTrigger({ branch_includes, branch_excludes }),
    repo: parseRepoConnection(t.repo_connection),
  };
}

function parseBuildSummary(raw: unknown): BuildSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.build_uuid !== "string") return null;
  const meta =
    b.build_trigger_metadata && typeof b.build_trigger_metadata === "object"
      ? (b.build_trigger_metadata as Record<string, unknown>)
      : null;
  return {
    build_uuid: b.build_uuid,
    build_outcome: typeof b.build_outcome === "string" ? b.build_outcome : null,
    created_on: typeof b.created_on === "string" ? b.created_on : null,
    branch: meta && typeof meta.branch === "string" ? meta.branch : null,
    commit_hash: meta && typeof meta.commit_hash === "string" ? meta.commit_hash : null,
  };
}

interface ScriptTagEntry {
  name: string;
  tag: string;
}

export async function listWorkerScriptTags(): Promise<
  { ok: true; scripts: ScriptTagEntry[] } | { ok: false; error: string }
> {
  const tokens = scriptLookupTokens();
  if (tokens.length === 0) {
    return { ok: false, error: "未配置 CF_WORKER_BUILDER 或其他 Cloudflare API Token" };
  }

  let lastError = "";
  for (const token of tokens) {
    const r = await cfAccountApi("GET", "/workers/scripts", token);
    if (r.json.success) {
      if (!Array.isArray(r.json.result)) return { ok: true, scripts: [] };
      const scripts: ScriptTagEntry[] = [];
      for (const item of r.json.result) {
        if (!item || typeof item !== "object") continue;
        const row = item as { id?: string; tag?: string };
        if (typeof row.id === "string" && typeof row.tag === "string") {
          scripts.push({ name: row.id, tag: row.tag });
        }
      }
      return { ok: true, scripts };
    }
    lastError = formatBuilderTokenError(r.json, r.status);
  }
  return { ok: false, error: lastError };
}

export function resolveScriptTag(
  scripts: ScriptTagEntry[],
  preferredNames: Array<string | null | undefined>,
): { tag: string; name: string } | null {
  for (const name of preferredNames) {
    if (!name) continue;
    const hit = scripts.find((s) => s.name === name);
    if (hit) return { tag: hit.tag, name: hit.name };
  }
  return null;
}

export function buildTriggerPatch(
  config: CloudflareBuildsConfig,
  trigger: Pick<BuildTriggerInfo, "is_preview">,
): Record<string, unknown> {
  return {
    root_directory: config.root_directory,
    build_command: config.build_command,
    deploy_command: trigger.is_preview ? config.preview_deploy_command : config.deploy_command,
    path_includes: config.path_includes,
    path_excludes: config.path_excludes,
  };
}

export async function getWorkerBuildsStatus(
  workerDir: string,
  wranglerName: string | null,
): Promise<WorkerBuildsStatus> {
  const base: WorkerBuildsStatus = {
    ok: false,
    token_configured: Boolean(buildsApiToken()),
    account_id: env.CF_ACCOUNT_ID,
    wrangler_name: wranglerName,
    config: readCloudflareBuildsConfig(workerDir),
    worker_tag: null,
    cf_script_name: null,
    name_mismatch: false,
    dashboard_builds_url: null,
    triggers: [],
    recent_builds: [],
  };

  if (!base.token_configured) {
    return buildsStatusError(base, "未配置 CF_WORKER_BUILDER（Workers CI Edit 用户 Token）");
  }

  const scriptsRes = await listWorkerScriptTags();
  if (!scriptsRes.ok) return buildsStatusError(base, scriptsRes.error);

  const preferred = [wranglerName, base.config?.worker_name];
  const resolved = resolveScriptTag(scriptsRes.scripts, preferred);
  if (!resolved) {
    return {
      ...base,
      error: `未在 Cloudflare 找到 Worker：${preferred.filter(Boolean).join(" / ") || "(无名称)"}`,
    };
  }

  base.worker_tag = resolved.tag;
  base.cf_script_name = resolved.name;
  base.name_mismatch = Boolean(wranglerName && wranglerName !== resolved.name);
  base.dashboard_builds_url = buildDashboardBuildsUrl(env.CF_ACCOUNT_ID, resolved.name);

  const triggersRes = await cfBuildsApi("GET", `/builds/workers/${resolved.tag}/triggers`);
  if (!triggersRes.json.success) {
    return buildsStatusError(base, cfBuildsError(triggersRes.json, triggersRes.status));
  }
  const rawTriggers = Array.isArray(triggersRes.json.result) ? triggersRes.json.result : [];
  base.triggers = rawTriggers
    .map(parseTrigger)
    .filter((t): t is BuildTriggerInfo => t !== null);

  const buildsRes = await cfBuildsApi(
    "GET",
    `/builds/workers/${resolved.tag}/builds?per_page=5`,
  );
  if (buildsRes.json.success && Array.isArray(buildsRes.json.result)) {
    base.recent_builds = buildsRes.json.result
      .map(parseBuildSummary)
      .filter((b): b is BuildSummary => b !== null);
  }

  return { ...base, ok: true };
}

export async function syncWorkerBuildsConfig(
  workerDir: string,
  wranglerName: string | null,
): Promise<
  | { ok: true; updated: string[]; cf_script_name: string }
  | { ok: false; error: string }
> {
  const config = readCloudflareBuildsConfig(workerDir);
  if (!config) {
    return { ok: false, error: "未找到或无法解析 worker/cloudflare-builds.json" };
  }

  const status = await getWorkerBuildsStatus(workerDir, wranglerName);
  if (!status.ok || !status.worker_tag) {
    return { ok: false, error: status.error ?? "无法获取 Builds 状态" };
  }
  if (status.triggers.length === 0) {
    return {
      ok: false,
      error: "未找到 Builds trigger：请先在 Cloudflare Dashboard 连接 GitHub 仓库",
    };
  }

  const updated: string[] = [];
  for (const trigger of status.triggers) {
    const patch = buildTriggerPatch(config, trigger);
    const r = await cfBuildsApi(
      "PATCH",
      `/builds/triggers/${trigger.trigger_uuid}`,
      patch,
    );
    if (!r.json.success) {
      return {
        ok: false,
        error: `${trigger.trigger_name}: ${cfBuildsError(r.json, r.status)}`,
      };
    }
    updated.push(trigger.trigger_name);
  }

  return {
    ok: true,
    updated,
    cf_script_name: status.cf_script_name ?? config.worker_name,
  };
}

export async function triggerWorkerBuild(
  workerDir: string,
  wranglerName: string | null,
  branch = "main",
): Promise<
  | { ok: true; build_uuid: string; trigger_name: string }
  | { ok: false; error: string }
> {
  const status = await getWorkerBuildsStatus(workerDir, wranglerName);
  if (!status.ok) return { ok: false, error: status.error ?? "无法获取 Builds 状态" };

  const production =
    status.triggers.find((t) => !t.is_preview) ?? status.triggers[0] ?? null;
  if (!production) {
    return { ok: false, error: "未找到 Builds trigger，请先在 Dashboard 连接 GitHub" };
  }

  const r = await cfBuildsApi(
    "POST",
    `/builds/triggers/${production.trigger_uuid}/builds`,
    { branch },
  );
  if (!r.json.success) {
    return { ok: false, error: cfBuildsError(r.json, r.status) };
  }
  const result = r.json.result;
  const build_uuid =
    result && typeof result === "object" && typeof (result as { build_uuid?: string }).build_uuid === "string"
      ? (result as { build_uuid: string }).build_uuid
      : "";
  if (!build_uuid) {
    return { ok: false, error: "构建已触发但未返回 build_uuid" };
  }
  return { ok: true, build_uuid, trigger_name: production.trigger_name };
}
