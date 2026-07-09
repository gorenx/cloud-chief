import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  extractFunctionSql,
  extractFunctionSqlFromSources,
  parseFunctionsFromSql,
} from "../src/functions.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const rpcMigration = readFileSync(
  join(repoRoot, "wren-supabase/migrations/0003_ai_gateway_rpc.sql"),
  "utf8",
);

describe("pg-migration-sql functions", () => {
  it("parseFunctionsFromSql finds spend_free_ai_credit", () => {
    expect(parseFunctionsFromSql(rpcMigration)).toEqual(["spend_free_ai_credit"]);
  });

  it("extractFunctionSql keeps body and grants", () => {
    const sql = extractFunctionSql(rpcMigration, "spend_free_ai_credit");
    expect(sql).toContain("create or replace function public.spend_free_ai_credit");
    expect(sql).toContain("grant execute on function");
    expect(sql).toContain("revoke all on function");
  });

  it("extractFunctionSqlFromSources merges migration files", () => {
    const merged = extractFunctionSqlFromSources([{ sql: rpcMigration }], "spend_free_ai_credit");
    expect(merged).toContain("security definer");
  });
});
