import { getDb } from "./connection";
import type { D1DatabaseBinding } from "../d1-database";

export function upsertWorkerProject(params: {
  id: string;
  rootRel: string;
  absDir: string;
  scriptName: string | null;
  compatibilityDate: string | null;
  tomlHash: string | null;
  devVarsHash: string | null;
  vars: Record<string, string>;
  d1Bindings: D1DatabaseBinding[];
  secretNames: Array<{ name: string; source: string; valueHash?: string | null }>;
  now?: number;
}): void {
  const now = params.now ?? Date.now();
  const db = getDb();
  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO worker_projects
        (id, root_rel, abs_dir, script_name, compatibility_date, toml_hash, dev_vars_hash,
         last_scanned_at, missing)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
       ON CONFLICT(id) DO UPDATE SET
         root_rel = excluded.root_rel,
         abs_dir = excluded.abs_dir,
         script_name = excluded.script_name,
         compatibility_date = excluded.compatibility_date,
         toml_hash = excluded.toml_hash,
         dev_vars_hash = excluded.dev_vars_hash,
         last_scanned_at = excluded.last_scanned_at,
         missing = 0`,
    ).run(
      params.id,
      params.rootRel,
      params.absDir,
      params.scriptName,
      params.compatibilityDate,
      params.tomlHash,
      params.devVarsHash,
      now,
    );

    db.prepare("DELETE FROM worker_project_vars WHERE project_id = ?").run(params.id);
    const insertVar = db.prepare(
      `INSERT INTO worker_project_vars (project_id, key, value, source, updated_at)
       VALUES (?, ?, ?, 'wrangler', ?)`,
    );
    for (const [key, value] of Object.entries(params.vars)) {
      insertVar.run(params.id, key, value, now);
    }

    db.prepare("DELETE FROM worker_project_d1_bindings WHERE project_id = ?").run(params.id);
    const insertD1 = db.prepare(
      `INSERT INTO worker_project_d1_bindings
        (project_id, binding, database_name, database_id, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const binding of params.d1Bindings) {
      insertD1.run(params.id, binding.binding, binding.database_name, binding.database_id, now);
    }

    db.prepare("DELETE FROM worker_project_secret_names WHERE project_id = ?").run(params.id);
    const insertSecret = db.prepare(
      `INSERT INTO worker_project_secret_names
        (project_id, name, source, value_hash, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const secret of params.secretNames) {
      insertSecret.run(params.id, secret.name, secret.source, secret.valueHash ?? null, now);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function markMissingWorkerProjects(activeIds: string[]): void {
  const placeholders = activeIds.map(() => "?").join(", ");
  getDb()
    .prepare(
      `UPDATE worker_projects
       SET missing = 1, last_scanned_at = ?
       ${activeIds.length ? `WHERE id NOT IN (${placeholders})` : ""}`,
    )
    .run(Date.now(), ...activeIds);
}

export function listWorkerProjectsSnapshot(): Array<{
  id: string;
  root_rel: string;
  abs_dir: string;
  script_name: string | null;
  compatibility_date: string | null;
  last_scanned_at: number;
  missing: boolean;
}> {
  const rows = getDb()
    .prepare(
      `SELECT id, root_rel, abs_dir, script_name, compatibility_date, last_scanned_at, missing
       FROM worker_projects
       WHERE missing = 0
       ORDER BY root_rel ASC`,
    )
    .all() as Array<{
    id: string;
    root_rel: string;
    abs_dir: string;
    script_name: string | null;
    compatibility_date: string | null;
    last_scanned_at: number;
    missing: number;
  }>;
  return rows.map((row) => ({ ...row, missing: Boolean(row.missing) }));
}

