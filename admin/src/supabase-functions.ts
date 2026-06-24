import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { env, workerRoot } from "./env";
import { deployProjectFunction, listProjectFunctions, type RemoteFunctionRow } from "./supabase-management";

export const DEFAULT_FUNCTIONS_REL_DIR = "supabase/functions";
export const LEGACY_FUNCTIONS_REL_DIR = "supabase/functions";
export const FUNCTION_ENTRY_FILE = "index.ts";

const MAX_FUNCTION_FILE_BYTES = 5 * 1024 * 1024;
const FUNCTION_FILE_RE = /\.(ts|tsx|js|mjs|json|wasm|txt|md)$/i;

export interface LocalFunction {
  slug: string;
  dir: string;
  entrypoint: string;
  files: string[];
}

export type FunctionSyncStatus = "synced" | "local_only" | "remote_only";

export interface FunctionCompareRow {
  slug: string;
  local: boolean;
  remote: boolean;
  status: FunctionSyncStatus;
  file_count: number;
  local_files: string[];
  entrypoint?: string;
  remote_status?: string;
  updated_at?: string | null;
}

export interface FunctionDirCandidate {
  path: string;
  count: number;
}

export interface BrowseDirEntry {
  name: string;
  path: string;
  has_children: boolean;
}

export function defaultFunctionsDir(): string {
  return path.join(workerRoot, DEFAULT_FUNCTIONS_REL_DIR);
}

function legacyFunctionsDir(): string {
  return path.join(workerRoot, LEGACY_FUNCTIONS_REL_DIR);
}

function describeDirAccess(dir: string): { ok: true } | { ok: false; error: string } {
  try {
    const st = fs.statSync(dir);
    if (!st.isDirectory()) {
      return { ok: false, error: `路径不是目录：${dir}` };
    }
    fs.accessSync(dir, fs.constants.R_OK);
    return { ok: true };
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return { ok: false, error: `目录不存在：${dir}` };
    }
    if (err.code === "EACCES" || err.code === "EPERM") {
      return { ok: false, error: `目录无权访问：${dir}` };
    }
    return { ok: false, error: `目录不可读：${dir}` };
  }
}

function knownFunctionsDirs(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (p: string) => {
    const normalized = path.normalize(p);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  };

  const fromEnv = resolveFunctionsDir();
  if (fromEnv) add(fromEnv);
  add(defaultFunctionsDir());
  add(legacyFunctionsDir());
  return out;
}

export function normalizeFunctionsRelDir(rel: string): string {
  return rel.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

export function resolveFunctionsDir(input?: string | null): string | null {
  const raw = (input?.trim() || env.SUPABASE_FUNCTIONS_DIR?.trim() || "").replace(/\\/g, "/");
  if (!raw || raw.includes("\0")) return null;

  if (path.isAbsolute(raw)) {
    return path.normalize(raw);
  }

  const rel = normalizeFunctionsRelDir(raw);
  if (!rel || rel.includes("..")) return null;
  return path.resolve(workerRoot, rel);
}

export function getConfiguredFunctionsDir(): string {
  for (const candidate of knownFunctionsDirs()) {
    if (describeDirAccess(candidate).ok) return candidate;
  }
  return resolveFunctionsDir() ?? defaultFunctionsDir();
}

function resolveBrowseDir(input?: string | null): string | null {
  if (input?.trim()) {
    const resolved = resolveFunctionsDir(input);
    if (resolved && describeDirAccess(resolved).ok) return resolved;
  }

  const configured = getConfiguredFunctionsDir();
  if (describeDirAccess(configured).ok) return configured;

  const fallback = defaultFunctionsDir();
  if (fallback !== configured && describeDirAccess(fallback).ok) return fallback;

  const home = os.homedir();
  if (describeDirAccess(home).ok) return home;
  return null;
}

function functionsDirOrError(dirInput?: string | null):
  | { ok: true; dir: string; path: string }
  | { ok: false; error: string } {
  if (dirInput?.trim()) {
    const dir = resolveFunctionsDir(dirInput.trim());
    if (!dir) return { ok: false, error: `无效的 Functions 目录: ${dirInput.trim()}` };
    const access = describeDirAccess(dir);
    if (!access.ok) return access;
    return { ok: true, dir, path: dir };
  }
  const dir = getConfiguredFunctionsDir();
  const access = describeDirAccess(dir);
  if (!access.ok) return access;
  return { ok: true, dir, path: dir };
}

function isValidFunctionSlug(slug: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(slug);
}

function countLocalFunctionsInDir(dir: string): number {
  try {
    return listLocalFunctions(dir).length;
  } catch {
    return 0;
  }
}

export function listFunctionDirCandidates(): FunctionDirCandidate[] {
  const out: FunctionDirCandidate[] = [];

  for (const candidate of knownFunctionsDirs()) {
    if (!describeDirAccess(candidate).ok) continue;
    out.push({ path: candidate, count: countLocalFunctionsInDir(candidate) });
  }

  return out.sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
}

export function browseFunctionsDir(browsePath?: string | null): {
  ok: true;
  path: string;
  parent: string | null;
  function_count: number;
  entries: BrowseDirEntry[];
} | { ok: false; error: string } {
  const root = resolveBrowseDir(browsePath);
  if (!root) return { ok: false, error: "无法解析浏览路径" };

  let parent: string | null = null;
  if (browsePath?.trim()) {
    const parentPath = path.dirname(root);
    parent = parentPath !== root ? parentPath : null;
  }

  let entries: BrowseDirEntry[] = [];
  try {
    entries = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => {
        const full = path.join(root, d.name);
        let has_children = false;
        try {
          has_children = fs.readdirSync(full).some((n) => {
            const child = path.join(full, n);
            return fs.statSync(child).isDirectory();
          });
        } catch {
          has_children = false;
        }
        return { name: d.name, path: full, has_children };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  return {
    ok: true,
    path: root,
    parent,
    function_count: countLocalFunctionsInDir(root),
    entries,
  };
}

function collectFunctionFiles(functionDir: string): Array<{ relativePath: string; content: Buffer }> {
  const out: Array<{ relativePath: string; content: Buffer }> = [];

  const walk = (dir: string, prefix: string) => {
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith(".")) continue;
      const full = path.join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        walk(full, rel);
        continue;
      }
      if (!st.isFile()) continue;
      if (!FUNCTION_FILE_RE.test(name) && name !== "deno.json") continue;
      if (st.size > MAX_FUNCTION_FILE_BYTES) continue;
      out.push({
        relativePath: rel.replace(/\\/g, "/"),
        content: fs.readFileSync(full),
      });
    }
  };

  walk(functionDir, "");
  return out;
}

export function listLocalFunctions(functionsDir: string): LocalFunction[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(functionsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const out: LocalFunction[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const slug = entry.name;
    if (!isValidFunctionSlug(slug)) continue;

    const dir = path.join(functionsDir, slug);
    const entryPath = path.join(dir, FUNCTION_ENTRY_FILE);
    try {
      if (!fs.statSync(entryPath).isFile()) continue;
    } catch {
      continue;
    }

    const files = collectFunctionFiles(dir).map((f) => f.relativePath).sort();
    out.push({
      slug,
      dir,
      entrypoint: FUNCTION_ENTRY_FILE,
      files,
    });
  }

  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

export function buildFunctionComparison(
  local: LocalFunction[],
  remote: Array<{ slug: string; status?: string; updated_at?: string | null }>,
): FunctionCompareRow[] {
  const localBySlug = new Map(local.map((f) => [f.slug, f]));
  const remoteBySlug = new Map(remote.map((f) => [f.slug, f]));
  const slugs = new Set([...localBySlug.keys(), ...remoteBySlug.keys()]);

  return [...slugs].sort().map((slug) => {
    const localFn = localBySlug.get(slug);
    const remoteFn = remoteBySlug.get(slug);
    const hasLocal = Boolean(localFn);
    const hasRemote = Boolean(remoteFn);
    const status: FunctionSyncStatus =
      hasLocal && hasRemote ? "synced" : hasLocal ? "local_only" : "remote_only";

    return {
      slug,
      local: hasLocal,
      remote: hasRemote,
      status,
      file_count: localFn?.files.length ?? 0,
      local_files: localFn?.files ?? [],
      entrypoint: localFn?.entrypoint,
      remote_status: remoteFn?.status,
      updated_at: remoteFn?.updated_at ?? null,
    };
  });
}

export async function getFunctionsStatus(
  ref: string,
  functionsDir?: string | null,
): Promise<
  | {
      ok: true;
      function_comparison: FunctionCompareRow[];
      function_summary: {
        local: number;
        remote: number;
        synced: number;
        pending: number;
      };
      pending_count: number;
      functions_dir: string;
      remote_list_limited?: boolean;
      remote_list_error?: string;
    }
  | { ok: false; error: string; needs_functions_scope?: boolean }
> {
  const picked = functionsDirOrError(functionsDir);
  if (!picked.ok) return picked;

  const local = listLocalFunctions(picked.dir);
  const remote = await listProjectFunctions(ref);

  let remoteFunctions: RemoteFunctionRow[] = [];
  let remoteListLimited = false;
  let remoteListError: string | undefined;

  if (!remote.ok) {
    const listDenied = remote.status === 403 || remote.needs_functions_scope;
    if (listDenied) {
      remoteListLimited = true;
      remoteListError = remote.error;
    } else {
      return remote;
    }
  } else {
    remoteFunctions = remote.functions;
  }

  const function_comparison = buildFunctionComparison(local, remoteFunctions);
  const pending_count = function_comparison.filter((r) => r.status === "local_only").length;

  return {
    ok: true,
    function_comparison,
    function_summary: {
      local: local.length,
      remote: remoteFunctions.length,
      synced: function_comparison.filter((r) => r.status === "synced").length,
      pending: pending_count,
    },
    pending_count,
    functions_dir: picked.path,
    remote_list_limited: remoteListLimited || undefined,
    remote_list_error: remoteListError,
  };
}

export async function deployLocalFunction(
  ref: string,
  slug: string,
  functionsDir?: string | null,
): Promise<
  { ok: true; slug: string } | { ok: false; error: string; needs_functions_scope?: boolean }
> {
  const picked = functionsDirOrError(functionsDir);
  if (!picked.ok) return picked;

  const normalized = slug.trim();
  if (!isValidFunctionSlug(normalized)) {
    return { ok: false, error: `无效的 function slug: ${slug}` };
  }

  const local = listLocalFunctions(picked.dir).find((f) => f.slug === normalized);
  if (!local) return { ok: false, error: `未找到本地 function: ${normalized}` };

  const files = collectFunctionFiles(local.dir);
  return deployProjectFunction(ref, normalized, files);
}

export async function deployPendingFunctions(
  ref: string,
  functionsDir?: string | null,
): Promise<
  | { ok: true; deployed: string[] }
  | { ok: false; error: string; needs_functions_scope?: boolean; partial?: string[] }
> {
  const status = await getFunctionsStatus(ref, functionsDir);
  if (!status.ok) return status;

  const pending = status.function_comparison
    .filter((r) => r.status === "local_only")
    .map((r) => r.slug);
  const deployed: string[] = [];

  for (const slug of pending) {
    const r = await deployLocalFunction(ref, slug, functionsDir);
    if (!r.ok) {
      return { ok: false, error: r.error, needs_functions_scope: r.needs_functions_scope, partial: deployed };
    }
    deployed.push(r.slug);
  }

  return { ok: true, deployed };
}
