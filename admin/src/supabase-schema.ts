import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { env, workerRoot } from "./env";
import {
  applyDatabaseMigration,
  listDatabaseMigrations,
  runProjectDatabaseQuery,
} from "./supabase-management";

export const DEFAULT_MIGRATIONS_REL_DIR = "supabase/migrations";

export function defaultMigrationsDir(): string {
  return path.join(workerRoot, DEFAULT_MIGRATIONS_REL_DIR);
}

export interface LocalMigration {
  version: string;
  filename: string;
  sql: string;
}

export interface MigrationRow {
  version: string;
  filename: string;
  applied: boolean;
}

export interface TableRlsStatus {
  name: string;
  rls_enabled: boolean;
  policy_count: number;
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

export function getConfiguredMigrationsDir(): string {
  return resolveMigrationsDir() ?? defaultMigrationsDir();
}

function resolveBrowseDir(input?: string | null): string | null {
  if (input?.trim()) {
    const resolved = resolveMigrationsDir(input);
    if (!resolved) return null;
    try {
      if (!fs.statSync(resolved).isDirectory()) return null;
    } catch {
      return null;
    }
    return resolved;
  }

  const configured = getConfiguredMigrationsDir();
  try {
    if (fs.statSync(configured).isDirectory()) return configured;
  } catch {
    /* fall through */
  }

  const home = os.homedir();
  try {
    if (fs.statSync(home).isDirectory()) return home;
  } catch {
    return null;
  }
  return home;
}

function migrationsDirOrError(dirInput?: string | null):
  | { ok: true; dir: string; path: string }
  | { ok: false; error: string } {
  if (dirInput?.trim()) {
    const dir = resolveMigrationsDir(dirInput.trim());
    if (!dir) return { ok: false, error: `无效的迁移目录: ${dirInput.trim()}` };
    return { ok: true, dir, path: dir };
  }
  const dir = getConfiguredMigrationsDir();
  return { ok: true, dir, path: dir };
}

export function browseMigrationsDir(input?: string | null):
  | { ok: true; path: string; parent: string | null; migration_count: number; entries: BrowseDirEntry[] }
  | { ok: false; error: string } {
  const abs = resolveBrowseDir(input);
  if (!abs) return { ok: false, error: "目录不可读" };

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch {
    return { ok: false, error: "目录不可读" };
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
  const seen = new Set<string>();
  const out: MigrationDirCandidate[] = [];

  for (const candidate of [getConfiguredMigrationsDir(), defaultMigrationsDir()]) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
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

export async function listRemoteMigrationVersions(
  ref: string,
): Promise<{ ok: true; versions: Set<string> } | { ok: false; error: string; needs_db_scope?: boolean }> {
  const remote = await listDatabaseMigrations(ref);
  if (!remote.ok) return remote;
  const versions = new Set<string>();
  for (const row of remote.migrations) {
    const v = row.version?.trim() || row.name?.trim();
    if (v) versions.add(v);
  }
  return { ok: true, versions };
}

export function mergeMigrationStatus(
  local: LocalMigration[],
  appliedVersions: Set<string>,
): MigrationRow[] {
  return local.map((m) => ({
    version: m.version,
    filename: m.filename,
    applied: appliedVersions.has(m.version),
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
    `select tablename, count(*)::int as policy_count
     from pg_policies
     where schemaname = 'public'
     group by tablename`,
    { readOnly: true },
  );
  if (!policiesQ.ok) return policiesQ;

  const policyMap = new Map<string, number>();
  for (const row of asRows(policiesQ.result)) {
    const table = String(row.tablename ?? "");
    policyMap.set(table, Number(row.policy_count ?? 0));
  }

  const tables: TableRlsStatus[] = [];
  for (const row of asRows(tablesQ.result)) {
    const name = String(row.name ?? "");
    if (!name) continue;
    tables.push({
      name,
      rls_enabled: Boolean(row.rls_enabled),
      policy_count: policyMap.get(name) ?? 0,
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
      migrations: MigrationRow[];
      tables: TableRlsStatus[];
      pending_count: number;
      migrations_dir: string;
    }
  | { ok: false; error: string; needs_db_scope?: boolean }
> {
  const picked = migrationsDirOrError(migrationsDir);
  if (!picked.ok) return picked;

  const local = listLocalMigrations(picked.dir);
  const remote = await listRemoteMigrationVersions(ref);
  if (!remote.ok) return remote;

  const migrations = mergeMigrationStatus(local, remote.versions);
  const tables = await fetchTableRlsStatus(ref);
  if (!tables.ok) return tables;

  return {
    ok: true,
    migrations,
    tables: tables.tables,
    pending_count: migrations.filter((m) => !m.applied).length,
    migrations_dir: picked.path,
  };
}

export async function applyLocalMigration(
  ref: string,
  version: string,
  migrationsDir?: string | null,
): Promise<{ ok: true; version: string } | { ok: false; error: string; needs_db_scope?: boolean }> {
  const picked = migrationsDirOrError(migrationsDir);
  if (!picked.ok) return picked;

  const local = listLocalMigrations(picked.dir).find((m) => m.version === version);
  if (!local) return { ok: false, error: `未找到本地迁移 ${version}` };

  const applied = await applyDatabaseMigration(ref, local.version, local.sql);
  return applied.ok ? { ok: true, version: local.version } : applied;
}

export async function applyPendingMigrations(
  ref: string,
  migrationsDir?: string | null,
): Promise<
  | { ok: true; applied: string[] }
  | { ok: false; error: string; needs_db_scope?: boolean; partial?: string[] }
> {
  const status = await getMigrationStatus(ref, migrationsDir);
  if (!status.ok) return status;

  const pending = status.migrations.filter((m) => !m.applied).map((m) => m.version);
  const applied: string[] = [];

  for (const version of pending) {
    const r = await applyLocalMigration(ref, version, migrationsDir);
    if (!r.ok) {
      return { ok: false, error: r.error, needs_db_scope: r.needs_db_scope, partial: applied };
    }
    applied.push(r.version);
  }

  return { ok: true, applied };
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
