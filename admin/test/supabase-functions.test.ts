import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildFunctionComparison,
  listLocalFunctions,
  resolveFunctionsDir,
  browseFunctionsDir,
} from "../src/supabase-functions";
import { functionsPermissionHintForTest } from "../src/supabase-management";

describe("supabase-functions", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-fn-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("listLocalFunctions finds subdirs with index.ts", () => {
    const hello = path.join(tmpDir, "hello-world");
    fs.mkdirSync(hello, { recursive: true });
    fs.writeFileSync(path.join(hello, "index.ts"), 'Deno.serve(() => new Response("ok"));');

    const skip = path.join(tmpDir, "no-entry");
    fs.mkdirSync(skip);
    fs.writeFileSync(path.join(skip, "main.ts"), "export {}");

    const rows = listLocalFunctions(tmpDir);
    expect(rows.map((r) => r.slug)).toEqual(["hello-world"]);
    expect(rows[0].files).toContain("index.ts");
  });

  it("buildFunctionComparison marks local_only and synced", () => {
    const local = [
      {
        slug: "hello-world",
        dir: path.join(tmpDir, "hello-world"),
        entrypoint: "index.ts",
        files: ["index.ts"],
      },
    ];
    const rows = buildFunctionComparison(local, [
      { slug: "hello-world", status: "ACTIVE" },
      { slug: "remote-only", status: "ACTIVE" },
    ]);
    expect(rows.find((r) => r.slug === "hello-world")?.status).toBe("synced");
    expect(rows.find((r) => r.slug === "hello-world")?.local_files).toEqual(["index.ts"]);
    expect(rows.find((r) => r.slug === "remote-only")?.status).toBe("remote_only");
  });

  it("resolveFunctionsDir accepts absolute paths", () => {
    const resolved = resolveFunctionsDir(tmpDir);
    expect(resolved).toBe(path.normalize(tmpDir));
  });

  it("browseFunctionsDir lists child directories", () => {
    fs.mkdirSync(path.join(tmpDir, "child-a"));
    fs.mkdirSync(path.join(tmpDir, "child-b"));
    const result = browseFunctionsDir(tmpDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entries.map((e) => e.name)).toEqual(["child-a", "child-b"]);
    }
  });

  it("does not treat deploy failure messages as scope errors", () => {
    expect(functionsPermissionHintForTest(500, "Failed to deploy function")).toBe(false);
    expect(functionsPermissionHintForTest(403, "Forbidden")).toBe(true);
  });
});
