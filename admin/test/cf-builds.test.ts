import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  buildDashboardBuildsUrl,
  buildTriggerPatch,
  formatBuilderTokenError,
  isBuilderTokenInvalidMessage,
  isPreviewTrigger,
  readCloudflareBuildsConfig,
  resolveScriptTag,
} from "../src/cf-builds";

const workerDir = path.resolve(import.meta.dirname, "../../worker");

describe("cf-builds helpers", () => {
  it("readCloudflareBuildsConfig loads worker/cloudflare-builds.json", () => {
    const cfg = readCloudflareBuildsConfig(workerDir);
    expect(cfg?.worker_name).toBe("ai-gateway-proxy");
    expect(cfg?.root_directory).toBe("worker");
    expect(cfg?.path_includes).toEqual(["worker/*"]);
  });

  it("isPreviewTrigger detects non-production branch trigger", () => {
    expect(isPreviewTrigger({ branch_includes: ["main"], branch_excludes: [] })).toBe(false);
    expect(isPreviewTrigger({ branch_includes: ["*"], branch_excludes: ["main"] })).toBe(true);
  });

  it("buildTriggerPatch picks deploy command by trigger type", () => {
    const cfg = readCloudflareBuildsConfig(workerDir)!;
    const prod = buildTriggerPatch(cfg, { is_preview: false });
    const preview = buildTriggerPatch(cfg, { is_preview: true });
    expect(prod.deploy_command).toBe("npx wrangler deploy");
    expect(preview.deploy_command).toBe("npx wrangler versions upload");
    expect(prod.path_includes).toEqual(["worker/*"]);
  });

  it("resolveScriptTag prefers first matching script name", () => {
    const scripts = [
      { name: "qwen-gateway-proxy", tag: "tag-old" },
      { name: "ai-gateway-proxy", tag: "tag-new" },
    ];
    expect(resolveScriptTag(scripts, ["ai-gateway-proxy", "qwen-gateway-proxy"])?.tag).toBe(
      "tag-new",
    );
    expect(resolveScriptTag(scripts, ["missing", "qwen-gateway-proxy"])?.name).toBe(
      "qwen-gateway-proxy",
    );
  });

  it("buildDashboardBuildsUrl encodes script name", () => {
    expect(buildDashboardBuildsUrl("acc", "ai-gateway-proxy")).toContain("acc");
    expect(buildDashboardBuildsUrl("acc", "ai-gateway-proxy")).toContain("ai-gateway-proxy");
  });

  it("formatBuilderTokenError explains Invalid token for account tokens", () => {
    const msg = formatBuilderTokenError({ errors: [{ message: "Invalid token" }] }, 401);
    expect(msg).toContain("用户级");
    expect(msg).toContain("My Profile");
  });

  it("isBuilderTokenInvalidMessage detects auth errors", () => {
    expect(isBuilderTokenInvalidMessage("Invalid token")).toBe(true);
    expect(isBuilderTokenInvalidMessage("Authentication error")).toBe(true);
    expect(isBuilderTokenInvalidMessage("Builds API 鉴权失败")).toBe(true);
    expect(isBuilderTokenInvalidMessage("Worker not found")).toBe(false);
  });
});
