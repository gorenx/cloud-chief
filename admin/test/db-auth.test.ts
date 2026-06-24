import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, initDatabase } from "../src/db/connection";
import { env } from "../src/env";
import { encryptValue, decryptValue } from "../src/db/crypto";
import { authenticateUser } from "../src/db/users";
import { createSession, resolveSessionUser } from "../src/db/sessions";

describe("admin sqlite auth", () => {
  let dbPath = "";

  beforeEach(() => {
    closeDatabase();
    dbPath = path.join(os.tmpdir(), `admin-auth-${Date.now()}-${Math.random()}.db`);
    process.env.ADMIN_DB_PATH = dbPath;
    process.env.ADMIN_DB_ENCRYPT = "0";
    process.env.ADMIN_DB_ENCRYPTION_KEY = "";
    initDatabase();
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    delete process.env.ADMIN_DB_PATH;
  });

  it("seeds default admin user", () => {
    const user = authenticateUser("admin", "123456");
    expect(user?.username).toBe("admin");
    expect(authenticateUser("admin", "wrong")).toBeNull();
  });

  it("creates and resolves session", () => {
    const user = authenticateUser("admin", "123456");
    expect(user).not.toBeNull();
    const { token } = createSession(user!.id);
    expect(resolveSessionUser(token)?.username).toBe("admin");
  });

  it("encrypts config when enabled", () => {
    Object.assign(env, {
      ADMIN_DB_ENCRYPT: true,
      ADMIN_DB_ENCRYPTION_KEY: "test-secret-key-for-encryption",
    });
    const plain = "secret-value";
    const enc = encryptValue(plain);
    expect(enc).not.toBe(plain);
    expect(decryptValue(enc)).toBe(plain);
  });
});
