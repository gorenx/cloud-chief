import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabase } from "../src/db/connection";
import { createApp } from "../src/app";

describe("auth routes", () => {
  let dbPath = "";

  beforeEach(() => {
    closeDatabase();
    dbPath = path.join(os.tmpdir(), `admin-auth-route-${Date.now()}-${Math.random()}.db`);
    process.env.ADMIN_DB_PATH = dbPath;
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    delete process.env.ADMIN_DB_PATH;
  });

  it("login session grants admin access", async () => {
    const app = createApp();
    const login = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "123456" }),
    });
    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie");
    expect(cookie).toContain("admin_session=");

    const me = await app.request("/auth/me", { headers: { cookie: cookie ?? "" } });
    const meJson = (await me.json()) as { authenticated: boolean; user?: { username: string } };
    expect(meJson.authenticated).toBe(true);
    expect(meJson.user?.username).toBe("admin");

    const state = await app.request("/admin/state", { headers: { cookie: cookie ?? "" } });
    expect(state.status).toBe(200);
  });
});
