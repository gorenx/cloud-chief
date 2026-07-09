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

export const cloudflareDb = new Hono();

cloudflareDb.use("*", adminAuth);

// Cloudflare D1：创建数据库，并可选写入选中 worker 的 wrangler.toml binding / 执行 migrations/*.sql。
cloudflareDb.post("/d1/databases", async (c) => {
  const dir = resolveWorkerDirQuery(c.req.query("dir"));
  if (dir === null) return c.json({ error: "无效的 worker 目录" }, 400);
  if (!env.CF_API_TOKEN) return c.json({ error: "未配置 CF_API_TOKEN" }, 400);

  const parsed = d1DatabaseCreate.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: zodMessage(parsed.error) }, 400);

  const { name, binding, update_wrangler, apply_migrations } = parsed.data;
  const created = await createD1Database(name);
  if (!created.ok) {
    return c.json(
      { error: created.error, cloudflare: created.json },
      created.status === 401 || created.status === 403 ? 403 : 400,
    );
  }

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
    } else {
      wrangler = { updated: true, databases: write.databases, error: null };
    }
  }

  if (wrangler.error) {
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

  const bindingConfig = { binding, database_name, database_id };
  const write = writeD1DatabaseBinding(dir, bindingConfig);
  if (!write.ok) {
    return c.json({ error: `写入 wrangler.toml 失败: ${write.error}` }, 500);
  }

  const migrations = apply_migrations
    ? await applyD1Migrations(database_id, dir)
    : { ok: true as const, applied: [] };

  if (!migrations.ok) {
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

  return c.json({
    ok: true,
    binding: bindingConfig,
    wrangler: { updated: true, databases: write.databases, error: null },
    migrations,
  });
});
