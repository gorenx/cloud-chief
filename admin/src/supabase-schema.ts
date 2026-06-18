import fs from "node:fs";
import path from "node:path";
import { workerRoot } from "./env";
import {
  applyDatabaseMigration,
  listDatabaseMigrations,
  runProjectDatabaseQuery,
} from "./supabase-management";

export const supabaseMigrationsDir = path.join(workerRoot, "supabase", "migrations");

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

export function parseMigrationFilename(filename: string): string | null {
  if (!/^\d+_.+\.sql$/i.test(filename)) return null;
  return filename.replace(/\.sql$/i, "");
}

export function listLocalMigrations(dir = supabaseMigrationsDir): LocalMigration[] {
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

export async function getMigrationStatus(ref: string): Promise<
  | {
      ok: true;
      migrations: MigrationRow[];
      tables: TableRlsStatus[];
      pending_count: number;
    }
  | { ok: false; error: string; needs_db_scope?: boolean }
> {
  const local = listLocalMigrations();
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
  };
}

export async function applyLocalMigration(
  ref: string,
  version: string,
): Promise<{ ok: true; version: string } | { ok: false; error: string; needs_db_scope?: boolean }> {
  const local = listLocalMigrations().find((m) => m.version === version);
  if (!local) return { ok: false, error: `未找到本地迁移 ${version}` };

  const applied = await applyDatabaseMigration(ref, local.version, local.sql);
  return applied.ok ? { ok: true, version: local.version } : applied;
}

export async function applyPendingMigrations(
  ref: string,
): Promise<
  | { ok: true; applied: string[] }
  | { ok: false; error: string; needs_db_scope?: boolean; partial?: string[] }
> {
  const status = await getMigrationStatus(ref);
  if (!status.ok) return status;

  const pending = status.migrations.filter((m) => !m.applied).map((m) => m.version);
  const applied: string[] = [];

  for (const version of pending) {
    const r = await applyLocalMigration(ref, version);
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
