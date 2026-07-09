import { describe, expect, it } from "vitest";
import {
  listD1Databases,
  parseD1Databases,
  setD1DatabaseBinding,
  splitD1SqlStatements,
} from "../src/d1-database";

describe("d1 database wrangler helpers", () => {
  it("parses and updates an existing D1 binding", () => {
    const toml = `name = "auth"

[[d1_databases]]
binding = "DB"
database_name = "old"
database_id = "old-id"

[vars]
APP_NAME = "Auth"
`;

    const next = setD1DatabaseBinding(toml, {
      binding: "DB",
      database_name: "cloud-chief-auth",
      database_id: "new-id",
    });

    expect(parseD1Databases(next)).toEqual([
      { binding: "DB", database_name: "cloud-chief-auth", database_id: "new-id" },
    ]);
    expect(next).toContain("[vars]");
    expect(next).toContain('APP_NAME = "Auth"');
  });

  it("appends a D1 binding when one does not exist", () => {
    const next = setD1DatabaseBinding('name = "auth"\n', {
      binding: "DB",
      database_name: "cloud-chief-auth",
      database_id: "new-id",
    });

    expect(next).toContain("[[d1_databases]]");
    expect(parseD1Databases(next)).toEqual([
      { binding: "DB", database_name: "cloud-chief-auth", database_id: "new-id" },
    ]);
  });
});

describe("listD1Databases", () => {
  it("normalizes Cloudflare D1 list results", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          success: true,
          result: [
            { uuid: "db1", name: "one", created_at: "2026-01-01", version: "alpha" },
            { id: "db2", name: "two" },
            { name: "missing-id" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as typeof fetch;

    try {
      const r = await listD1Databases();
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.databases).toEqual([
          { id: "db1", name: "one", created_at: "2026-01-01", version: "alpha" },
          { id: "db2", name: "two", created_at: null, version: null },
        ]);
      }
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe("splitD1SqlStatements", () => {
  it("splits multi-statement migrations and ignores comments", () => {
    const statements = splitD1SqlStatements(`
-- comment with ; semicolon
PRAGMA foreign_keys = ON;
CREATE TABLE "user" (
  "id" text PRIMARY KEY,
  "note" text DEFAULT 'a; b'
);
/* block ; comment */
CREATE INDEX IF NOT EXISTS "user_id_idx" ON "user" ("id");
`);

    expect(statements).toEqual([
      "PRAGMA foreign_keys = ON",
      `CREATE TABLE "user" (
  "id" text PRIMARY KEY,
  "note" text DEFAULT 'a; b'
)`,
      'CREATE INDEX IF NOT EXISTS "user_id_idx" ON "user" ("id")',
    ]);
  });
});
