import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { env, workerRoot } from "./env";
import {
  applyDatabaseMigration,
  listDatabaseMigrations,
  runProjectDatabaseQuery,
} from "./supabase-management";
import { extractTableSqlFromSources, parsePoliciesFromSql, parseTablesFromSql, parseFunctionsFromSql, extractFunctionSqlFromSources } from "pg-migration-sql";

export const DEFAULT_MIGRATIONS_REL_DIR = "wren-supabase/migrations";
export const LEGACY_MIGRATIONS_REL_DIR = "supabase/migrations";

export function defaultMigrationsDir(): string {
  return path.join(workerRoot, DEFAULT_MIGRATIONS_REL_DIR);
}

function legacyMigrationsDir(): string {
  return path.join(workerRoot, LEGACY_MIGRATIONS_REL_DIR);
}

function knownMigrationsDirs(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (p: string) => {
    const normalized = path.normalize(p);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  };

  const fromEnv = resolveMigrationsDir();
  if (fromEnv) add(fromEnv);
  add(defaultMigrationsDir());
  add(legacyMigrationsDir());
  return out;
}

export interface LocalMigration {
  version: string;
  filename: string;
  sql: string;
}

export interface MigrationFileRow {
  version: string;
  filename: string;
  tables: string[];
  functions: string[];
}

export interface FunctionCompareRow {
  name: string;
  local: boolean;
  remote: boolean;
  status: MigrationSyncStatus;
  source_files: string[];
}

export type MigrationSyncStatus = "synced" | "local_only" | "remote_only";

export interface TableCompareRow {
  name: string;
  local: boolean;
  remote: boolean;
  status: MigrationSyncStatus;
  source_files: string[];
  rls_enabled?: boolean;
  policy_count?: number;
  local_policies: string[];
  remote_policies: string[];
}

export interface TableRlsStatus {
  name: string;
  rls_enabled: boolean;
  policy_count: number;
  policies: string[];
}

export interface MigrationDirCandidate {
  path: string;
  count: number;
}

export interface BrowseDirEntry {
  name: string;
  path: string;
  has_children: boolean;
}

/** @deprecated legacy relative paths in .env */
export function normalizeMigrationsRelDir(rel: string): string {
  return rel.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

export function resolveMigrationsDir(input?: string | null): string | null {
  const raw = (input?.trim() || env.SUPABASE_MIGRATIONS_DIR?.trim() || "").replace(/\\/g, "/");
  if (!raw || raw.includes("\0")) return null;

  if (path.isAbsolute(raw)) {
    return path.normalize(raw);
  }

  const rel = normalizeMigrationsRelDir(raw);
  if (!rel || rel.includes("..")) return null;
  return path.resolve(workerRoot, rel);
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

export function isMigrationsDirReadable(dir: string): boolean {
  return describeDirAccess(dir).ok;
}

export function getConfiguredMigrationsDir(): string {
  for (const candidate of knownMigrationsDirs()) {
    if (describeDirAccess(candidate).ok) return candidate;
  }
  return resolveMigrationsDir() ?? defaultMigrationsDir();
}

function resolveBrowseDir(input?: string | null): string | null {
  if (input?.trim()) {
    const resolved = resolveMigrationsDir(input);
    if (resolved && describeDirAccess(resolved).ok) return resolved;
    /* 显式路径无效时回退到已配置/默认/主目录，避免选择器直接报错 */
  }

  const configured = getConfiguredMigrationsDir();
  if (describeDirAccess(configured).ok) return configured;

  const fallback = defaultMigrationsDir();
  if (fallback !== configured && describeDirAccess(fallback).ok) return fallback;

  const home = os.homedir();
  if (describeDirAccess(home).ok) return home;
  return null;
}

function migrationsDirOrError(dirInput?: string | null):
  | { ok: true; dir: string; path: string }
  | { ok: false; error: string } {
  if (dirInput?.trim()) {
    const dir = resolveMigrationsDir(dirInput.trim());
    if (!dir) return { ok: false, error: `无效的迁移目录: ${dirInput.trim()}` };
    const access = describeDirAccess(dir);
    if (!access.ok) return access;
    return { ok: true, dir, path: dir };
  }
  const dir = getConfiguredMigrationsDir();
  const access = describeDirAccess(dir);
  if (!access.ok) return access;
  return { ok: true, dir, path: dir };
}

export function browseMigrationsDir(input?: string | null):
  | { ok: true; path: string; parent: string | null; migration_count: number; entries: BrowseDirEntry[] }
  | { ok: false; error: string } {
  const abs = resolveBrowseDir(input);
  if (!abs) {
    return { ok: false, error: "无法定位可浏览的目录，请检查本机路径权限" };
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "EACCES" || err.code === "EPERM") {
      return { ok: false, error: `目录无权访问：${abs}` };
    }
    return { ok: false, error: `无法列出目录内容：${abs}` };
  }

  const dirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
    .sort((a, b) => a.name.localeCompare(b.name));

  const browseEntries: BrowseDirEntry[] = [];
  for (const d of dirs) {
    const childAbs = path.join(abs, d.name);
    let has_children = false;
    try {
      has_children = fs
        .readdirSync(childAbs, { withFileTypes: true })
        .some((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules");
    } catch {
      has_children = false;
    }
    browseEntries.push({ name: d.name, path: childAbs, has_children });
  }

  const parentPath = path.dirname(abs);
  const parent = parentPath !== abs ? parentPath : null;

  return {
    ok: true,
    path: abs,
    parent,
    migration_count: listLocalMigrations(abs).length,
    entries: browseEntries,
  };
}

export function listMigrationDirCandidates(): MigrationDirCandidate[] {
  const out: MigrationDirCandidate[] = [];

  for (const candidate of knownMigrationsDirs()) {
    if (!describeDirAccess(candidate).ok) continue;
    out.push({ path: candidate, count: listLocalMigrations(candidate).length });
  }

  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export function parseMigrationFilename(filename: string): string | null {
  if (!/^\d+_.+\.sql$/i.test(filename)) return null;
  return filename.replace(/\.sql$/i, "");
}

export function listLocalMigrations(dir: string): LocalMigration[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const out: LocalMigration[] = [];
  for (const filename of files) {
    const version = parseMigrationFilename(filename);
    if (!version) continue;
    const sql = fs.readFileSync(path.join(dir, filename), "utf8").trim();
    if (!sql) continue;
    out.push({ version, filename, sql });
  }
  return out;
}

export function resolveTableSql(migrations: LocalMigration[], tableName: string): string | null {
  return extractTableSqlFromSources(migrations, tableName);
}

export function resolveFunctionSql(migrations: LocalMigration[], functionName: string): string | null {
  return extractFunctionSqlFromSources(migrations, functionName);
}

export function indexLocalFunctions(
  migrations: LocalMigration[],
): { names: Set<string>; sourceFiles: Map<string, string[]> } {
  const names = new Set<string>();
  const sourceFiles = new Map<string, string[]>();

  for (const migration of migrations) {
    for (const fn of parseFunctionsFromSql(migration.sql)) {
      names.add(fn);
      const files = sourceFiles.get(fn) ?? [];
      if (!files.includes(migration.filename)) files.push(migration.filename);
      sourceFiles.set(fn, files);
    }
  }

  return { names, sourceFiles };
}

export function buildFunctionComparison(
  localNames: Set<string>,
  remoteNames: Set<string>,
  sourceFiles: Map<string, string[]>,
): FunctionCompareRow[] {
  const all = new Set([...localNames, ...remoteNames]);
  return [...all].sort((a, b) => a.localeCompare(b)).map((name) => {
    const local = localNames.has(name);
    const remote = remoteNames.has(name);
    const status: MigrationSyncStatus =
      local && remote ? "synced" : local ? "local_only" : "remote_only";
    return {
      name,
      local,
      remote,
      status,
      source_files: sourceFiles.get(name) ?? [],
    };
  });
}

export async function fetchRemoteRoutineNames(
  ref: string,
): Promise<
  { ok: true; names: Set<string> } | { ok: false; error: string; needs_db_scope?: boolean }
> {
  const q = await runProjectDatabaseQuery(
    ref,
    `select distinct p.proname as routine_name
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind in ('f', 'p')
     order by routine_name`,
    { readOnly: true },
  );
  if (!q.ok) return q;

  const names = new Set<string>();
  for (const row of asRows(q.result)) {
    const name = String(row.routine_name ?? row.name ?? "").trim().toLowerCase();
    if (name) names.add(name);
  }
  return { ok: true, names };
}

export function indexLocalTables(
  migrations: LocalMigration[],
): {
  names: Set<string>;
  sourceFiles: Map<string, string[]>;
  localPolicies: Map<string, string[]>;
} {
  const names = new Set<string>();
  const sourceFiles = new Map<string, string[]>();
  const localPolicies = new Map<string, Set<string>>();

  for (const migration of migrations) {
    for (const table of parseTablesFromSql(migration.sql)) {
      names.add(table);
      const files = sourceFiles.get(table) ?? [];
      if (!files.includes(migration.filename)) files.push(migration.filename);
      sourceFiles.set(table, files);
    }
    for (const policy of parsePoliciesFromSql(migration.sql)) {
      names.add(policy.table);
      const set = localPolicies.get(policy.table) ?? new Set<string>();
      set.add(policy.name);
      localPolicies.set(policy.table, set);
    }
  }

  const policyMap = new Map<string, string[]>();
  for (const [table, set] of localPolicies) {
    policyMap.set(table, [...set].sort((a, b) => a.localeCompare(b)));
  }

  return { names, sourceFiles, localPolicies: policyMap };
}

export function buildTableComparison(
  localTableNames: Set<string>,
  remoteTables: TableRlsStatus[],
  sourceFiles: Map<string, string[]>,
  localPolicies: Map<string, string[]>,
): TableCompareRow[] {
  const remoteByName = new Map(remoteTables.map((t) => [t.name.toLowerCase(), t]));
  const all = new Set([...localTableNames, ...remoteTables.map((t) => t.name.toLowerCase())]);

  return [...all].sort((a, b) => a.localeCompare(b)).map((name) => {
    const local = localTableNames.has(name);
    const remoteInfo = remoteByName.get(name);
    const remote = Boolean(remoteInfo);
    const status: MigrationSyncStatus =
      local && remote ? "synced" : local ? "local_only" : "remote_only";
    return {
      name,
      local,
      remote,
      status,
      source_files: sourceFiles.get(name) ?? [],
      rls_enabled: remoteInfo?.rls_enabled,
      policy_count: remoteInfo?.policy_count,
      local_policies: localPolicies.get(name) ?? [],
      remote_policies: remoteInfo?.policies ?? [],
    };
  });
}

export async function listRemoteMigrationVersions(
  ref: string,
): Promise<
  | { ok: true; versions: Set<string>; list: string[] }
  | { ok: false; error: string; needs_db_scope?: boolean }
> {
  const remote = await listDatabaseMigrations(ref);
  if (!remote.ok) return remote;

  const versions = new Set<string>();
  for (const row of remote.migrations) {
    const v = row.version?.trim() || row.name?.trim();
    if (v) versions.add(v);
  }

  const schemaQ = await runProjectDatabaseQuery(
    ref,
    `select version from supabase_migrations.schema_migrations order by version`,
    { readOnly: true },
  );
  if (schemaQ.ok) {
    for (const row of asRows(schemaQ.result)) {
      const v = String(row.version ?? "").trim();
      if (v) versions.add(v);
    }
  }

  const list = [...versions].sort((a, b) => a.localeCompare(b));
  return { ok: true, versions, list };
}

export function buildMigrationFileRows(local: LocalMigration[]): MigrationFileRow[] {
  return local.map((m) => ({
    version: m.version,
    filename: m.filename,
    tables: parseTablesFromSql(m.sql),
    functions: parseFunctionsFromSql(m.sql),
  }));
}

export async function fetchTableRlsStatus(
  ref: string,
): Promise<
  { ok: true; tables: TableRlsStatus[] } | { ok: false; error: string; needs_db_scope?: boolean }
> {
  const tablesQ = await runProjectDatabaseQuery(
    ref,
    `select c.relname as name, c.relrowsecurity as rls_enabled
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
     order by c.relname`,
    { readOnly: true },
  );
  if (!tablesQ.ok) return tablesQ;

  const policiesQ = await runProjectDatabaseQuery(
    ref,
    `select tablename, policyname
     from pg_policies
     where schemaname = 'public'
     order by tablename, policyname`,
    { readOnly: true },
  );
  if (!policiesQ.ok) return policiesQ;

  const policyMap = new Map<string, string[]>();
  for (const row of asRows(policiesQ.result)) {
    const table = String(row.tablename ?? "");
    const policy = String(row.policyname ?? "").trim();
    if (!table || !policy) continue;
    const list = policyMap.get(table) ?? [];
    list.push(policy);
    policyMap.set(table, list);
  }

  const tables: TableRlsStatus[] = [];
  for (const row of asRows(tablesQ.result)) {
    const name = String(row.name ?? "");
    if (!name) continue;
    const policies = policyMap.get(name) ?? [];
    tables.push({
      name,
      rls_enabled: Boolean(row.rls_enabled),
      policy_count: policies.length,
      policies,
    });
  }
  return { ok: true, tables };
}

export async function getMigrationStatus(
  ref: string,
  migrationsDir?: string | null,
): Promise<
  | {
      ok: true;
      migration_files: MigrationFileRow[];
      table_comparison: TableCompareRow[];
      function_comparison: FunctionCompareRow[];
      table_summary: {
        local: number;
        remote: number;
        synced: number;
        pending: number;
      };
      function_summary: {
        local: number;
        remote: number;
        synced: number;
        pending: number;
      };
      tables: TableRlsStatus[];
      pending_count: number;
      migrations_dir: string;
    }
  | { ok: false; error: string; needs_db_scope?: boolean }
> {
  const picked = migrationsDirOrError(migrationsDir);
  if (!picked.ok) return picked;

  const local = listLocalMigrations(picked.dir);
  const migration_files = buildMigrationFileRows(local);
  const { names: localTableNames, sourceFiles, localPolicies } = indexLocalTables(local);
  const { names: localFunctionNames, sourceFiles: functionSourceFiles } = indexLocalFunctions(local);

  const tables = await fetchTableRlsStatus(ref);
  if (!tables.ok) return tables;

  const remoteRoutines = await fetchRemoteRoutineNames(ref);
  if (!remoteRoutines.ok) return remoteRoutines;

  const table_comparison = buildTableComparison(
    localTableNames,
    tables.tables,
    sourceFiles,
    localPolicies,
  );
  const function_comparison = buildFunctionComparison(
    localFunctionNames,
    remoteRoutines.names,
    functionSourceFiles,
  );
  const table_pending = table_comparison.filter((r) => r.status === "local_only").length;
  const function_pending = function_comparison.filter((r) => r.status === "local_only").length;

  return {
    ok: true,
    migration_files,
    table_comparison,
    function_comparison,
    table_summary: {
      local: localTableNames.size,
      remote: tables.tables.length,
      synced: table_comparison.filter((r) => r.status === "synced").length,
      pending: table_pending,
    },
    function_summary: {
      local: localFunctionNames.size,
      remote: remoteRoutines.names.size,
      synced: function_comparison.filter((r) => r.status === "synced").length,
      pending: function_pending,
    },
    tables: tables.tables,
    pending_count: table_pending + function_pending,
    migrations_dir: picked.path,
  };
}

export async function applyTableMigration(
  ref: string,
  table: string,
  migrationsDir?: string | null,
): Promise<
  { ok: true; table: string; skipped?: boolean }
  | { ok: false; error: string; needs_db_scope?: boolean }
> {
  const picked = migrationsDirOrError(migrationsDir);
  if (!picked.ok) return picked;

  const tableName = table.trim().toLowerCase();
  if (!/^[a-z_][\w]*$/i.test(tableName)) {
    return { ok: false, error: `无效的表名: ${table}` };
  }

  const sql = resolveTableSql(listLocalMigrations(picked.dir), tableName);
  if (!sql) return { ok: false, error: `未找到表 ${tableName} 的本地 SQL` };

  const applied = await applyDatabaseMigration(ref, `tbl_${tableName}`, sql);
  return applied.ok ? { ok: true, table: tableName, skipped: applied.skipped } : applied;
}

export async function applyFunctionMigration(
  ref: string,
  functionName: string,
  migrationsDir?: string | null,
): Promise<
  { ok: true; function: string; skipped?: boolean }
  | { ok: false; error: string; needs_db_scope?: boolean }
> {
  const picked = migrationsDirOrError(migrationsDir);
  if (!picked.ok) return picked;

  const fn = functionName.trim().toLowerCase();
  if (!/^[a-z_][\w]*$/i.test(fn)) {
    return { ok: false, error: `无效的函数名: ${functionName}` };
  }

  const sql = resolveFunctionSql(listLocalMigrations(picked.dir), fn);
  if (!sql) return { ok: false, error: `未找到函数 ${fn} 的本地 SQL` };

  const applied = await applyDatabaseMigration(ref, `fn_${fn}`, sql);
  return applied.ok ? { ok: true, function: fn, skipped: applied.skipped } : applied;
}

export async function applyPendingTables(
  ref: string,
  migrationsDir?: string | null,
): Promise<
  | { ok: true; applied: string[] }
  | { ok: false; error: string; needs_db_scope?: boolean; partial?: string[] }
> {
  const status = await getMigrationStatus(ref, migrationsDir);
  if (!status.ok) return status;

  const pending = status.table_comparison
    .filter((r) => r.status === "local_only")
    .map((r) => r.name);
  const applied: string[] = [];

  for (const table of pending) {
    const r = await applyTableMigration(ref, table, migrationsDir);
    if (!r.ok) {
      return { ok: false, error: r.error, needs_db_scope: r.needs_db_scope, partial: applied };
    }
    applied.push(r.table);
  }

  return { ok: true, applied };
}

export async function applyPendingFunctions(
  ref: string,
  migrationsDir?: string | null,
): Promise<
  | { ok: true; applied: string[] }
  | { ok: false; error: string; needs_db_scope?: boolean; partial?: string[] }
> {
  const status = await getMigrationStatus(ref, migrationsDir);
  if (!status.ok) return status;

  const pending = status.function_comparison
    .filter((r) => r.status === "local_only")
    .map((r) => r.name);
  const applied: string[] = [];

  for (const fn of pending) {
    const r = await applyFunctionMigration(ref, fn, migrationsDir);
    if (!r.ok) {
      return { ok: false, error: r.error, needs_db_scope: r.needs_db_scope, partial: applied };
    }
    applied.push(r.function);
  }

  return { ok: true, applied };
}

export async function applyPendingMigrations(
  ref: string,
  migrationsDir?: string | null,
): Promise<
  | { ok: true; applied_tables: string[]; applied_functions: string[] }
  | { ok: false; error: string; needs_db_scope?: boolean; partial_tables?: string[]; partial_functions?: string[] }
> {
  const tables = await applyPendingTables(ref, migrationsDir);
  if (!tables.ok) {
    return {
      ok: false,
      error: tables.error,
      needs_db_scope: tables.needs_db_scope,
      partial_tables: tables.partial,
      partial_functions: [],
    };
  }

  const functions = await applyPendingFunctions(ref, migrationsDir);
  if (!functions.ok) {
    return {
      ok: false,
      error: functions.error,
      needs_db_scope: functions.needs_db_scope,
      partial_tables: tables.applied,
      partial_functions: functions.partial,
    };
  }

  return {
    ok: true,
    applied_tables: tables.applied,
    applied_functions: functions.applied,
  };
}

function asRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === "object") {
    const o = result as Record<string, unknown>;
    if (Array.isArray(o.result)) return o.result as Record<string, unknown>[];
    if (Array.isArray(o.rows)) return o.rows as Record<string, unknown>[];
  }
  return [];
}
