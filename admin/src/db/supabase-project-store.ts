import { getDb } from "./connection";
import { parseJson } from "./store-utils";
import type { SupabaseProject } from "../supabase-management";

export function upsertSupabaseProjects(projects: SupabaseProject[], now = Date.now()): void {
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO supabase_projects
      (ref, name, organization_id, region, status, payload_json, last_seen_at, last_synced_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
     ON CONFLICT(ref) DO UPDATE SET
       name = excluded.name,
       organization_id = excluded.organization_id,
       region = excluded.region,
       status = excluded.status,
       payload_json = excluded.payload_json,
       last_seen_at = excluded.last_seen_at,
       last_synced_at = excluded.last_synced_at,
       deleted_at = NULL`,
  );
  db.exec("BEGIN");
  try {
    for (const project of projects) {
      insert.run(
        project.ref,
        project.name,
        project.organization_id,
        project.region ?? null,
        (project as { status?: string }).status ?? null,
        JSON.stringify(project),
        now,
        now,
      );
    }
    const refs = projects.map((p) => p.ref);
    const placeholders = refs.map(() => "?").join(", ");
    db.prepare(
      `UPDATE supabase_projects
       SET deleted_at = COALESCE(deleted_at, ?)
       ${refs.length ? `WHERE ref NOT IN (${placeholders})` : ""}`,
    ).run(now, ...refs);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function listSupabaseProjectsSnapshot(): SupabaseProject[] {
  const rows = getDb()
    .prepare(
      `SELECT payload_json FROM supabase_projects
       WHERE deleted_at IS NULL
       ORDER BY name ASC, ref ASC`,
    )
    .all() as Array<{ payload_json: string }>;
  return rows
    .map((row) =>
      parseJson<SupabaseProject>(row.payload_json, {
        id: "",
        ref: "",
        name: "",
        organization_id: "",
      }),
    )
    .filter((p) => p.ref);
}

export function supabaseProjectsLastSyncedAt(): number | null {
  const row = getDb()
    .prepare("SELECT MAX(last_synced_at) AS at FROM supabase_projects WHERE deleted_at IS NULL")
    .get() as { at: number | null } | undefined;
  return row?.at ?? null;
}

