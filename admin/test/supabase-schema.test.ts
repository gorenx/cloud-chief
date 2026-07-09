import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildMigrationFileRows,
  buildFunctionComparison,
  buildTableComparison,
  resolveTableSql,
  parseMigrationFilename,
  listLocalMigrations,
  normalizeMigrationsRelDir,
  resolveMigrationsDir,
  browseMigrationsDir,
  listMigrationDirCandidates,
  defaultMigrationsDir,
  getConfiguredMigrationsDir,
  isMigrationsDirReadable,
} from "../src/supabase-schema";
import { parseFunctionsFromSql, parseTablesFromSql } from "pg-migration-sql";

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

  it("resolveTableSql merges statements from multiple files", () => {
    const migrations = [
      {
        version: "0001_user_state",
        filename: "0001_user_state.sql",
        sql: "create table user_state (id uuid);",
      },
      {
        version: "0002_user_state_policies",
        filename: "0002_user_state_policies.sql",
        sql: 'create policy "owner reads" on public.user_state for select using (true);',
      },
    ];
    const sql = resolveTableSql(migrations, "user_state");
    expect(sql).toContain("create table user_state");
    expect(sql).toContain('create policy "owner reads"');
  });

  it("listLocalMigrations reads sorted sql files", () => {
    fs.writeFileSync(path.join(tmpDir, "002_other.sql"), "select 1;");
    fs.writeFileSync(path.join(tmpDir, "001_profiles.sql"), "create table profiles;");
    fs.writeFileSync(path.join(tmpDir, "skip.txt"), "nope");

    const rows = listLocalMigrations(tmpDir);
    expect(rows.map((r) => r.version)).toEqual(["001_profiles", "002_other"]);
    expect(rows[0].sql).toContain("create table");
  });

  it("buildMigrationFileRows lists tables per file", () => {
    const local = [
      {
        version: "0001_user_state",
        filename: "0001_user_state.sql",
        sql: "create table user_state (id uuid); create table sync_log (id uuid);",
      },
    ];
    const files = buildMigrationFileRows(local);
    expect(files[0].tables).toEqual(["sync_log", "user_state"]);
    expect(files[0].functions).toEqual([]);
  });

  it("buildMigrationFileRows lists postgres routines from 0003", () => {
    const rpcPath = path.join(
      path.dirname(defaultMigrationsDir()),
      "0003_ai_gateway_rpc.sql",
    );
    if (!fs.existsSync(rpcPath)) return;
    const sql = fs.readFileSync(rpcPath, "utf8");
    const files = buildMigrationFileRows([
      { version: "0003_ai_gateway_rpc", filename: "0003_ai_gateway_rpc.sql", sql },
    ]);
    expect(files[0].functions).toContain("spend_free_ai_credit");
    expect(parseFunctionsFromSql(sql)).toEqual(["spend_free_ai_credit"]);
  });

  it("buildFunctionComparison marks local-only routines", () => {
    const rows = buildFunctionComparison(
      new Set(["spend_free_ai_credit"]),
      new Set<string>(),
      new Map([["spend_free_ai_credit", ["0003_ai_gateway_rpc.sql"]]]),
    );
    expect(rows[0]?.status).toBe("local_only");
  });

  it("buildTableComparison compares local sql tables with remote db", () => {
    const rows = buildTableComparison(
      new Set(["user_state", "ai_gateway"]),
      [
        {
          name: "user_state",
          rls_enabled: true,
          policy_count: 2,
          policies: ["owner reads", "owner writes"],
        },
        { name: "legacy", rls_enabled: false, policy_count: 0, policies: [] },
      ],
      new Map([
        ["user_state", ["0001_user_state.sql"]],
        ["ai_gateway", ["0002_ai_gateway.sql"]],
      ]),
      new Map([["user_state", ["owner reads"]]]),
    );
    const stateRow = rows.find((r) => r.name === "user_state");
    expect(stateRow?.status).toBe("synced");
    expect(stateRow?.local_policies).toEqual(["owner reads"]);
    expect(stateRow?.remote_policies).toEqual(["owner reads", "owner writes"]);
    expect(rows.find((r) => r.name === "ai_gateway")?.status).toBe("local_only");
    expect(rows.find((r) => r.name === "legacy")?.status).toBe("remote_only");
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
    const resolved = resolveMigrationsDir("wren-supabase/migrations");
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
    const result = browseMigrationsDir(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.path).toBe(tmpDir);
    expect(result.parent).toBeTruthy();
    expect(path.isAbsolute(result.parent!)).toBe(true);
  });

  it("browseMigrationsDir falls back when explicit path is missing", () => {
    const missing = path.join(tmpDir, "no-such-migrations");
    const result = browseMigrationsDir(missing);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.path).not.toBe(missing);
    expect(isMigrationsDirReadable(result.path)).toBe(true);
  });

  it("getConfiguredMigrationsDir prefers readable default over missing env path", () => {
    const defaultDir = defaultMigrationsDir();
    expect(isMigrationsDirReadable(defaultDir)).toBe(true);
    const configured = getConfiguredMigrationsDir();
    expect(isMigrationsDirReadable(configured)).toBe(true);
  });
});
