import { Hono } from "hono";
import { adminAuth } from "../auth";
import { env, workerRoot } from "../env";
import { resolveWorkerDirQuery } from "../worker-dir";
import { d1DatabaseBind, d1DatabaseCreate, zodMessage } from "../schemas";
import {
  applyD1Migrations,
  createD1Database,
  parseD1Databases,
  writeD1DatabaseBinding,
} from "../d1-database";
import { upsertCfD1Database } from "../db/resource-store";
import {
  finishSyncRun,
  recordSyncEvent,
  startSyncRun,
} from "../db/sync-store";
import { scanWorkerProjectsToDb } from "../worker-project-sync";
import { listD1DatabasesCached } from "../d1-sync";

export const cloudflareDb = new Hono();

cloudflareDb.use("*", adminAuth);

// Cloudflare D1：读取账号下数据库列表。默认读本地快照，过期或 refresh=1 时刷新。
cloudflareDb.get("/d1/databases", async (c) => {
  return c.json(await listD1DatabasesCached({ refresh: c.req.query("refresh") === "1" }));
});

// Cloudflare D1：创建数据库，并可选写入选中 worker 的 wrangler.toml binding / 执行 migrations/*.sql。
cloudflareDb.post("/d1/databases", async (c) => {
  const dir = resolveWorkerDirQuery(c.req.query("dir"));
  if (dir === null) return c.json({ error: "无效的 worker 目录" }, 400);
  if (!env.CF_API_TOKEN) return c.json({ error: "未配置 CF_API_TOKEN" }, 400);

  const parsed = d1DatabaseCreate.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: zodMessage(parsed.error) }, 400);

  const { name, binding, update_wrangler, apply_migrations } = parsed.data;
  const runId = startSyncRun("cloudflare", "d1");
  const created = await createD1Database(name);
  if (!created.ok) {
    recordSyncEvent({
      run_id: runId,
      resource_type: "cf_d1_database",
      resource_id: name,
      action: "create",
      status: "failed",
      message: created.error,
    });
    finishSyncRun(runId, "failed", { error: created.error });
    return c.json(
      { error: created.error, cloudflare: created.json },
      created.status === 401 || created.status === 403 ? 403 : 400,
    );
  }
  upsertCfD1Database(env.CF_ACCOUNT_ID, created.database);
  recordSyncEvent({
    run_id: runId,
    resource_type: "cf_d1_database",
    resource_id: created.database.id,
    action: "create",
    status: "success",
    message: created.database.name,
  });

  const bindingConfig = {
    binding,
    database_name: created.database.name,
    database_id: created.database.id,
  };

  let wrangler:
    | { updated: false; databases: null; error: null }
    | { updated: true; databases: ReturnType<typeof parseD1Databases>; error: null }
    | { updated: false; databases: null; error: string } = {
    updated: false,
    databases: null,
    error: null,
  };

  if (update_wrangler) {
    const write = writeD1DatabaseBinding(dir, bindingConfig);
    if (!write.ok) {
      wrangler = { updated: false, databases: null, error: write.error };
      recordSyncEvent({
        run_id: runId,
        resource_type: "worker_d1_binding",
        resource_id: `${binding}:${created.database.id}`,
        action: "bind",
        status: "failed",
        message: write.error,
      });
    } else {
      wrangler = { updated: true, databases: write.databases, error: null };
      scanWorkerProjectsToDb();
      recordSyncEvent({
        run_id: runId,
        resource_type: "worker_d1_binding",
        resource_id: `${binding}:${created.database.id}`,
        action: "bind",
        status: "success",
      });
    }
  }

  if (wrangler.error) {
    finishSyncRun(runId, "partial", { error: wrangler.error });
    return c.json(
      {
        ok: false,
        error: `数据库已创建，但写入 wrangler.toml 失败: ${wrangler.error}`,
        database: created.database,
        binding: bindingConfig,
        wrangler,
      },
      500,
    );
  }

  const migrations = apply_migrations
    ? await applyD1Migrations(created.database.id, dir)
    : { ok: true as const, applied: [] };

  if (!migrations.ok) {
    recordSyncEvent({
      run_id: runId,
      resource_type: "cf_d1_migrations",
      resource_id: created.database.id,
      action: "migrate",
      status: "failed",
      message: migrations.error,
    });
    finishSyncRun(runId, "partial", { error: migrations.error, stats: { applied: migrations.applied } });
    return c.json(
      {
        ok: false,
        error: `数据库已创建，但执行 D1 migration 失败: ${migrations.error}`,
        database: created.database,
        binding: bindingConfig,
        wrangler,
        migrations,
      },
      500,
    );
  }
  recordSyncEvent({
    run_id: runId,
    resource_type: "cf_d1_migrations",
    resource_id: created.database.id,
    action: "migrate",
    status: "success",
    message: migrations.applied.join(", "),
  });
  finishSyncRun(runId, "success", {
    stats: { database_id: created.database.id, applied: migrations.applied },
  });

  return c.json({
    ok: true,
    worker_root: workerRoot,
    database: created.database,
    binding: bindingConfig,
    wrangler,
    migrations,
  });
});

// Cloudflare D1：把已有数据库 binding 写入选中的 worker。
cloudflareDb.put("/d1/binding", async (c) => {
  const dir = resolveWorkerDirQuery(c.req.query("dir"));
  if (dir === null) return c.json({ error: "无效的 worker 目录" }, 400);

  const parsed = d1DatabaseBind.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: zodMessage(parsed.error) }, 400);

  const { database_name, database_id, binding, apply_migrations } = parsed.data;
  if (apply_migrations && !env.CF_API_TOKEN) return c.json({ error: "未配置 CF_API_TOKEN" }, 400);

  const runId = startSyncRun("worker_fs", "d1_binding");
  const bindingConfig = { binding, database_name, database_id };
  const write = writeD1DatabaseBinding(dir, bindingConfig);
  if (!write.ok) {
    recordSyncEvent({
      run_id: runId,
      resource_type: "worker_d1_binding",
      resource_id: `${binding}:${database_id}`,
      action: "bind",
      status: "failed",
      message: write.error,
    });
    finishSyncRun(runId, "failed", { error: write.error });
    return c.json({ error: `写入 wrangler.toml 失败: ${write.error}` }, 500);
  }
  scanWorkerProjectsToDb();
  recordSyncEvent({
    run_id: runId,
    resource_type: "worker_d1_binding",
    resource_id: `${binding}:${database_id}`,
    action: "bind",
    status: "success",
  });

  const migrations = apply_migrations
    ? await applyD1Migrations(database_id, dir)
    : { ok: true as const, applied: [] };

  if (!migrations.ok) {
    recordSyncEvent({
      run_id: runId,
      resource_type: "cf_d1_migrations",
      resource_id: database_id,
      action: "migrate",
      status: "failed",
      message: migrations.error,
    });
    finishSyncRun(runId, "partial", { error: migrations.error, stats: { applied: migrations.applied } });
    return c.json(
      {
        ok: false,
        error: `binding 已写入，但执行 D1 migration 失败: ${migrations.error}`,
        binding: bindingConfig,
        wrangler: { updated: true, databases: write.databases, error: null },
        migrations,
      },
      500,
    );
  }
  recordSyncEvent({
    run_id: runId,
    resource_type: "cf_d1_migrations",
    resource_id: database_id,
    action: "migrate",
    status: "success",
    message: migrations.applied.join(", "),
  });
  finishSyncRun(runId, "success", { stats: { applied: migrations.applied } });

  return c.json({
    ok: true,
    binding: bindingConfig,
    wrangler: { updated: true, databases: write.databases, error: null },
    migrations,
  });
});
