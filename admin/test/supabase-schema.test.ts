import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mergeMigrationStatus,
  parseMigrationFilename,
  listLocalMigrations,
  normalizeMigrationsRelDir,
  resolveMigrationsDir,
  browseMigrationsDir,
  listMigrationDirCandidates,
  defaultMigrationsDir,
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

  it("normalizeMigrationsRelDir trims slashes", () => {
    expect(normalizeMigrationsRelDir("/supabase/migrations/")).toBe("supabase/migrations");
  });

  it("resolveMigrationsDir rejects path traversal in relative paths", () => {
    expect(resolveMigrationsDir("../secret")).toBeNull();
    expect(resolveMigrationsDir("supabase/../../etc")).toBeNull();
  });

  it("resolveMigrationsDir accepts absolute paths", () => {
    expect(resolveMigrationsDir(tmpDir)).toBe(path.normalize(tmpDir));
  });

  it("resolveMigrationsDir accepts repo default migrations dir", () => {
    const resolved = resolveMigrationsDir("supabase/migrations");
    expect(resolved).toBeTruthy();
    expect(fs.existsSync(resolved!)).toBe(true);
  });

  it("listMigrationDirCandidates includes default migrations dir", () => {
    const defaultDir = defaultMigrationsDir();
    const found = listMigrationDirCandidates().some((c) => c.path === defaultDir);
    expect(found).toBe(true);
  });

  it("browseMigrationsDir returns absolute paths", () => {
    const result = browseMigrationsDir();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(path.isAbsolute(result.path)).toBe(true);
    for (const entry of result.entries) {
      expect(path.isAbsolute(entry.path)).toBe(true);
    }
  });

  it("browseMigrationsDir navigates with absolute path", () => {
    const migrationsDir = resolveMigrationsDir("supabase/migrations");
    expect(migrationsDir).toBeTruthy();
    const result = browseMigrationsDir(migrationsDir!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.path).toBe(migrationsDir);
    expect(result.parent).toBeTruthy();
    expect(path.isAbsolute(result.parent!)).toBe(true);
  });
});
