import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mergeMigrationStatus,
  parseMigrationFilename,
  listLocalMigrations,
} from "../src/supabase-schema";

describe("supabase-schema", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-mig-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("parseMigrationFilename accepts versioned sql names", () => {
    expect(parseMigrationFilename("001_profiles.sql")).toBe("001_profiles");
    expect(parseMigrationFilename("bad.sql")).toBeNull();
    expect(parseMigrationFilename("001.sql")).toBeNull();
  });

  it("listLocalMigrations reads sorted sql files", () => {
    fs.writeFileSync(path.join(tmpDir, "002_other.sql"), "select 1;");
    fs.writeFileSync(path.join(tmpDir, "001_profiles.sql"), "create table profiles;");
    fs.writeFileSync(path.join(tmpDir, "skip.txt"), "nope");

    const rows = listLocalMigrations(tmpDir);
    expect(rows.map((r) => r.version)).toEqual(["001_profiles", "002_other"]);
    expect(rows[0].sql).toContain("create table");
  });

  it("mergeMigrationStatus marks applied versions", () => {
    const local = [
      { version: "001_a", filename: "001_a.sql", sql: "a" },
      { version: "002_b", filename: "002_b.sql", sql: "b" },
    ];
    const merged = mergeMigrationStatus(local, new Set(["001_a"]));
    expect(merged).toEqual([
      { version: "001_a", filename: "001_a.sql", applied: true },
      { version: "002_b", filename: "002_b.sql", applied: false },
    ]);
  });
});
