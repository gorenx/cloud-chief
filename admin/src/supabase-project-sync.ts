import {
  listSupabaseProjects as listSupabaseProjectsLive,
  type SupabaseProject,
} from "./supabase-management";
import {
  listSupabaseProjectsSnapshot,
  supabaseProjectsLastSyncedAt,
  upsertSupabaseProjects,
} from "./db/resource-store";
import {
  finishSyncRun,
  recordSyncEvent,
  startSyncRun,
  syncMeta,
  type SyncMeta,
} from "./db/sync-store";

const SUPABASE_PROJECTS_TTL_MS = 300_000;

export interface SupabaseProjectListResult {
  ok: boolean;
  projects: SupabaseProject[];
  error?: string;
  _sync: SyncMeta;
}

export async function listSupabaseProjectsCached(
  options: { refresh?: boolean } = {},
): Promise<SupabaseProjectListResult> {
  const cached = listSupabaseProjectsSnapshot();
  const lastSyncedAt = supabaseProjectsLastSyncedAt();
  const shouldRefresh =
    options.refresh ||
    lastSyncedAt === null ||
    Date.now() - lastSyncedAt > SUPABASE_PROJECTS_TTL_MS;

  if (!shouldRefresh && cached.length > 0) {
    return {
      ok: true,
      projects: cached,
      _sync: syncMeta({
        source: "local_snapshot",
        lastSyncedAt,
        ttlMs: SUPABASE_PROJECTS_TTL_MS,
      }),
    };
  }

  const runId = startSyncRun("supabase", "projects");
  const live = await listSupabaseProjectsLive();
  if (!live.ok) {
    recordSyncEvent({
      run_id: runId,
      resource_type: "supabase_projects",
      resource_id: "projects",
      action: "refresh",
      status: "failed",
      message: live.error,
    });
    finishSyncRun(runId, "failed", { error: live.error });
    return {
      ok: cached.length > 0,
      projects: cached,
      error: live.error,
      _sync: syncMeta({
        source: cached.length ? "local_snapshot" : "none",
        lastSyncedAt,
        ttlMs: SUPABASE_PROJECTS_TTL_MS,
        error: live.error,
        runId,
      }),
    };
  }

  upsertSupabaseProjects(live.projects);
  recordSyncEvent({
    run_id: runId,
    resource_type: "supabase_projects",
    resource_id: "projects",
    action: "refresh",
    status: "success",
    message: `${live.projects.length} projects`,
  });
  finishSyncRun(runId, "success", { stats: { count: live.projects.length } });

  return {
    ok: true,
    projects: live.projects,
    _sync: syncMeta({
      source: "live",
      lastSyncedAt: Date.now(),
      ttlMs: SUPABASE_PROJECTS_TTL_MS,
      runId,
    }),
  };
}

