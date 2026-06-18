import { describe, it, expect } from "vitest";
import { readWranglerToml } from "../src/wrangler-vars";
import path from "node:path";
import { fileURLToPath } from "node:url";

const adminRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workerDir = path.resolve(adminRoot, "../worker");

describe("readWranglerToml", () => {
  it("reads name and SUPABASE_URL from worker wrangler.toml", () => {
    const { name, vars } = readWranglerToml(workerDir);
    expect(name).toBe("ai-gateway-proxy");
    expect(vars.SUPABASE_URL).toMatch(/^https:\/\//);
    expect(vars.DEFAULT_MODEL).toBeTruthy();
  });

  it("returns empty for missing dir", () => {
    const { name, vars } = readWranglerToml("/nonexistent");
    expect(name).toBeNull();
    expect(vars).toEqual({});
  });
});
