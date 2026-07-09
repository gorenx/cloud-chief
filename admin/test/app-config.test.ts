import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { closeDatabase, initDatabase } from "../src/db/connection";
import { getConfigValue, setConfigValue } from "../src/db/config-store";
import { overlayAppConfigFromDb, seedAppConfigFromEnv } from "../src/app-config-overlay";
import { env } from "../src/env";

const TOKEN = "test-token";
const authed = { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" };

describe("app-config", () => {
  let dbPath = "";

  beforeEach(() => {
    closeDatabase();
    dbPath = path.join(os.tmpdir(), `admin-config-${Date.now()}-${Math.random()}.db`);
    env.ADMIN_DB_PATH = dbPath;
    process.env.ADMIN_DB_PATH = dbPath;
    process.env.ADMIN_DB_ENCRYPT = "0";
    initDatabase();
    overlayAppConfigFromDb();
    env.ADMIN_TOKEN = TOKEN;
    process.env.ADMIN_TOKEN = TOKEN;
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    delete process.env.ADMIN_DB_PATH;
  });

  it("overlay prefers sqlite over env", () => {
    setConfigValue("MODEL", "from-db");
    overlayAppConfigFromDb();
    expect(env.MODEL).toBe("from-db");
  });

  it("seeds SQLite app_config from env only when DB is missing a value", () => {
    env.MODEL = "from-env";
    seedAppConfigFromEnv();
    expect(getConfigValue("MODEL")).toBe("from-env");

    env.MODEL = "changed-env";
    seedAppConfigFromEnv();
    expect(getConfigValue("MODEL")).toBe("from-env");
  });

  it("GET /admin/app-config lists sections", async () => {
    setConfigValue("MODEL", "qwen-test");
    const res = await app.request("/admin/app-config", { headers: authed });
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      sections: Array<{ id: string; fields: Array<{ key: string; in_db: boolean }> }>;
      bootstrap_keys: string[];
    };
    expect(j.bootstrap_keys).toContain("PORT");
    const model = j.sections.flatMap((s) => s.fields).find((f) => f.key === "MODEL");
    expect(model?.in_db).toBe(true);
  });

  it("GET /admin/app-config/field/:key reveals value", async () => {
    setConfigValue("WORKER_URL", "http://127.0.0.1:7777");
    const res = await app.request("/admin/app-config/field/WORKER_URL", { headers: authed });
    expect(res.status).toBe(200);
    const j = (await res.json()) as { value: string; source: string; in_db: boolean };
    expect(j.value).toBe("http://127.0.0.1:7777");
    expect(j.source).toBe("db");
    expect(j.in_db).toBe(true);
  });

  it("PUT /admin/app-config writes values", async () => {
    const res = await app.request("/admin/app-config", {
      method: "PUT",
      headers: authed,
      body: JSON.stringify({ values: { WORKER_URL: "http://127.0.0.1:9999" } }),
    });
    expect(res.status).toBe(200);
    expect(getConfigValue("WORKER_URL")).toBe("http://127.0.0.1:9999");
    expect(env.WORKER_URL).toBe("http://127.0.0.1:9999");
  });
});
