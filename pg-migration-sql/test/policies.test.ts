import { describe, it, expect } from "vitest";
import { parsePoliciesFromSql, policiesForTable } from "../src/policies";

describe("policies", () => {
  it("parsePoliciesFromSql extracts quoted policy names", () => {
    const sql = `
      create policy "owner reads" on public.user_state for select using (true);
      create policy owner_writes on profiles for insert with check (true);
    `;
    expect(parsePoliciesFromSql(sql)).toEqual([
      { name: "owner reads", table: "user_state" },
      { name: "owner_writes", table: "profiles" },
    ]);
  });

  it("policiesForTable filters by table", () => {
    const sql = 'create policy "owner reads" on public.user_state for select using (true);';
    expect(policiesForTable(sql, "user_state")).toEqual(["owner reads"]);
    expect(policiesForTable(sql, "other")).toEqual([]);
  });
});
