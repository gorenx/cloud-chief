import { describe, it, expect } from "vitest";
import {
  extractTableSql,
  extractTableSqlFromSources,
  parseTablesFromSql,
  splitSqlStatements,
  statementReferencesTable,
} from "../src/index";

describe("pg-migration-sql", () => {
  it("splitSqlStatements splits on semicolons", () => {
    expect(splitSqlStatements("select 1; select 2")).toEqual(["select 1", "select 2"]);
  });

  it("parseTablesFromSql uses parser for create table", () => {
    const sql = `
      create table if not exists public.user_state (id uuid primary key);
      create table profiles (id uuid primary key);
    `;
    expect(parseTablesFromSql(sql)).toEqual(["profiles", "user_state"]);
  });

  it("parseTablesFromSql parses multiple statements in one string", () => {
    const sql = "create table a (id int); create table b (id int);";
    expect(parseTablesFromSql(sql)).toEqual(["a", "b"]);
  });

  it("statementReferencesTable matches policy and alter via fallback", () => {
    const policy = 'create policy "owner reads" on public.user_state for select using (true);';
    const alter = "alter table public.user_state enable row level security;";
    expect(statementReferencesTable(policy, "user_state")).toBe(true);
    expect(statementReferencesTable(alter, "user_state")).toBe(true);
    expect(statementReferencesTable(policy, "other")).toBe(false);
  });

  it("extractTableSql keeps only statements for the target table", () => {
    const sql = `
      create table if not exists public.user_state (id uuid primary key);
      alter table public.user_state enable row level security;
      create policy "owner reads" on public.user_state for select using (true);
      create table public.other (id uuid);
    `;
    const extracted = extractTableSql(sql, "user_state");
    expect(extracted).toContain("create table");
    expect(extracted).toContain("enable row level security");
    expect(extracted).toContain('create policy "owner reads"');
    expect(extracted).not.toContain("public.other");
  });

  it("extractTableSqlFromSources merges multiple migration files", () => {
    const sql = extractTableSqlFromSources(
      [
        { sql: "create table user_state (id uuid);" },
        { sql: 'create policy "owner reads" on public.user_state for select using (true);' },
      ],
      "user_state",
    );
    expect(sql).toContain("create table user_state");
    expect(sql).toContain('create policy "owner reads"');
  });
});
