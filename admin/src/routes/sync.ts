import { Hono } from "hono";
import { adminAuth } from "../auth";
import { env } from "../env";
import { loadCfLists } from "../cf-resolve";
import { listCfDeployedWorkers } from "../cf-worker-resolve";
import { listD1DatabasesCached } from "../d1-sync";
import { listSupabaseProjectsCached } from "../supabase-project-sync";
import { scanWorkerProjectsToDb } from "../worker-project-sync";
import { getSyncRun, listLatestSyncRuns, listSyncEventsForRun } from "../db/sync-store";

export const syncRoutes = new Hono();

syncRoutes.use("*", adminAuth);

syncRoutes.get("/status", (c) => {
  return c.json({
    runs: listLatestSyncRuns().map((run) => ({
      ...run,
      stats: safeJson(run.stats_json),
    })),
  });
});

syncRoutes.get("/runs/:id", (c) => {
  const id = c.req.param("id");
  const run = getSyncRun(id);
  if (!run) {
    return c.json({ error: "Sync run not found" }, 404);
  }
  return c.json({
    run: {
      ...run,
      stats: safeJson(run.stats_json),
    },
    events: listSyncEventsForRun(id),
  });
});

syncRoutes.post("/refresh", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    source?: string;
    scope?: string;
  };
  const source = body.source ?? "all";
  const scope = body.scope ?? "all";

  const results: Record<string, unknown> = {};

  if (source === "all" || source === "cloudflare") {
    if (scope === "all" || scope === "ai_gateway") {
      results.ai_gateway = await loadCfLists({ refresh: true });
    }
    if (scope === "all" || scope === "d1") {
      results.d1 = await listD1DatabasesCached({ refresh: true });
    }
    if (scope === "all" || scope === "workers") {
      results.workers = await listCfDeployedWorkers(Boolean(env.CF_API_TOKEN), { refresh: true });
    }
  }

  if (source === "all" || source === "worker_fs") {
    if (scope === "all" || scope === "projects") {
      results.worker_projects = scanWorkerProjectsToDb();
    }
  }

  if (source === "all" || source === "supabase") {
    if (scope === "all" || scope === "projects") {
      results.supabase_projects = await listSupabaseProjectsCached({ refresh: true });
    }
  }

  return c.json({ ok: true, source, scope, results });
});

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
