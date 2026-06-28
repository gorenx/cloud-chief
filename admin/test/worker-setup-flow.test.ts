import { describe, expect, it } from "vitest";
import {
  deriveWorkerSetupStatus,
  nextWorkerSetupAction,
  resolveWorkerSetupCurrent,
  workerCoreDone,
  workerSetupProgress,
  workerSetupWarningKeys,
  workerStepDone,
} from "../src/worker-setup-flow";

const baseStatus = {
  worker_dir: "/repo/worker",
  worker_dir_rel: "worker",
  worker_dir_exists: true,
  worker_name: "ai-gateway-proxy",
  compatibility_date: "2026-01-01",
  vars: {
    CF_GATEWAY_ID: "qwen-gw",
    DEFAULT_MODEL: "qwen-plus",
  },
  secrets: [
    { name: "CF_AIG_TOKEN", optional: false },
    { name: "DASHSCOPE_API_KEY", optional: false },
  ],
  dev_vars: {
    CF_AIG_TOKEN: "tok",
    DASHSCOPE_API_KEY: "sk",
  },
  local_secrets: ["CF_AIG_TOKEN", "DASHSCOPE_API_KEY"],
  has_dev_vars: true,
  wrangler_version: "4.0.0",
  wrangler_error: null,
  logged_in: true,
  whoami: "test@example.com",
};

function derive(overrides: Partial<Parameters<typeof deriveWorkerSetupStatus>[0]> = {}) {
  return deriveWorkerSetupStatus({
    workerDir: "worker",
    status: baseStatus,
    vars: baseStatus.vars,
    secrets: [],
    prodSet: new Set(["CF_AIG_TOKEN", "DASHSCOPE_API_KEY"]),
    builds: undefined,
    deployedScriptNames: new Set(["ai-gateway-proxy"]),
    matchedOnline: true,
    ...overrides,
  });
}

describe("worker-setup-flow", () => {
  it("marks project and vars done when required fields present", () => {
    const s = derive();
    expect(s.projectDone).toBe(true);
    expect(s.varsDone).toBe(true);
    expect(s.secretsLocalDone).toBe(true);
    expect(s.deployDone).toBe(true);
    expect(workerCoreDone(s)).toBe(true);
  });

  it("detects missing vars", () => {
    const s = derive({ vars: { CF_GATEWAY_ID: "gw" } });
    expect(s.varsDone).toBe(false);
    expect(s.missingVars).toContain("DEFAULT_MODEL");
    expect(resolveWorkerSetupCurrent(s)).toBe("vars");
    expect(nextWorkerSetupAction(s)?.step).toBe("vars");
  });

  it("detects missing local secrets", () => {
    const s = derive({
      status: {
        ...baseStatus,
        dev_vars: { DASHSCOPE_API_KEY: "sk" },
      },
      prodSet: new Set(["DASHSCOPE_API_KEY"]),
    });
    expect(s.secretsLocalDone).toBe(false);
    expect(s.missingLocalSecrets).toContain("CF_AIG_TOKEN");
  });

  it("tracks secret names for flow card detail", () => {
    const s = derive();
    expect(s.secretNames).toEqual(["CF_AIG_TOKEN", "DASHSCOPE_API_KEY"]);
  });

  it("suggests optional CI after deploy when CI not configured", () => {
    const s = derive({
      builds: {
        ok: false,
        token_configured: false,
        name_mismatch: false,
        triggers: [],
        recent_builds: [],
      },
    });
    expect(workerStepDone("ci", s)).toBe(false);
    expect(nextWorkerSetupAction(s)?.step).toBe("ci");
  });

  it("suggests deploy when core ready but not online", () => {
    const s = derive({
      deployedScriptNames: new Set(),
      matchedOnline: false,
    });
    expect(workerCoreDone(s)).toBe(true);
    expect(s.deployDone).toBe(false);
    expect(nextWorkerSetupAction(s)?.step).toBe("deploy");
  });

  it("workerSetupProgress counts core and total steps", () => {
    const s = derive();
    const p = workerSetupProgress(s);
    expect(p.coreDone).toBe(3);
    expect(p.totalDone).toBeGreaterThanOrEqual(4);
  });

  it("workerSetupWarnings suggests CI when deploy done without CI", () => {
    const s = derive({
      builds: {
        ok: false,
        token_configured: false,
        name_mismatch: false,
        triggers: [],
        recent_builds: [],
      },
    });
    expect(workerSetupWarningKeys(s)).toContain("ciOptional");
  });
});
