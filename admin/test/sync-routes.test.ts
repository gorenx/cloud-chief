import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { closeDatabase, initDatabase } from "../src/db/connection";
import { finishSyncRun, recordSyncEvent, startSyncRun } from "../src/db/sync-store";
import { env } from "../src/env";

const TOKEN = "test-token";
const authed = { authorization: `Bearer ${TOKEN}` };

describe("sync routes", () => {
  let dbPath = "";

  beforeEach(() => {
    closeDatabase();
    dbPath = path.join(os.tmpdir(), `admin-sync-${Date.now()}-${Math.random()}.db`);
    env.ADMIN_DB_PATH = dbPath;
    process.env.ADMIN_DB_PATH = dbPath;
    env.ADMIN_TOKEN = TOKEN;
    process.env.ADMIN_TOKEN = TOKEN;
    initDatabase();
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    delete process.env.ADMIN_DB_PATH;
  });

  it("GET /admin/sync/runs/:id returns run details and events", async () => {
    const runId = startSyncRun("cloudflare", "d1");
    recordSyncEvent({
      run_id: runId,
      resource_type: "cf_d1_database",
      resource_id: "db-1",
      action: "refresh",
      status: "success",
      message: "ok",
    });
    finishSyncRun(runId, "success", { stats: { databases: 1 } });

    const res = await app.request(`/admin/sync/runs/${runId}`, { headers: authed });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      run: { id: string; stats: { databases: number } };
      events: Array<{ resource_id: string; action: string; status: string }>;
    };
    expect(json.run.id).toBe(runId);
    expect(json.run.stats.databases).toBe(1);
    expect(json.events).toEqual([
      expect.objectContaining({
        resource_id: "db-1",
        action: "refresh",
        status: "success",
      }),
    ]);
  });

  it("GET /admin/sync/runs/:id returns 404 for missing runs", async () => {
    const res = await app.request("/admin/sync/runs/missing", { headers: authed });
    expect(res.status).toBe(404);
  });
});
