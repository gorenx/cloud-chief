import type { ChildProcess } from "node:child_process";
import { spawnWrangler } from "./wrangler";
import { workerDir } from "./env";

let devChild: ChildProcess | null = null;

function defaultLocalHealthUrl(): string {
  return "http://127.0.0.1:8788/health";
}

export async function probeLocalWorkerHealth(url = defaultLocalHealthUrl()): Promise<boolean> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}

export function getWorkerDevProcessStatus(): { running: boolean; pid: number | null } {
  const running = devChild !== null && devChild.exitCode === null && !devChild.killed;
  return { running, pid: running ? (devChild?.pid ?? null) : null };
}

export async function startWorkerDev(cwd: string = workerDir): Promise<
  { ok: true; already_running: boolean } | { ok: false; error: string }
> {
  if (await probeLocalWorkerHealth()) {
    return { ok: true, already_running: true };
  }

  const { running } = getWorkerDevProcessStatus();
  if (running) {
    return { ok: true, already_running: true };
  }

  try {
    devChild = spawnWrangler(["dev"], cwd);
    devChild.on("exit", () => {
      devChild = null;
    });
    devChild.on("error", () => {
      devChild = null;
    });
  } catch (e) {
    devChild = null;
    return { ok: false, error: (e as Error).message };
  }

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await probeLocalWorkerHealth()) {
      return { ok: true, already_running: false };
    }
    if (!getWorkerDevProcessStatus().running) {
      return { ok: false, error: "wrangler dev 进程已退出，请检查 worker/ 配置" };
    }
  }

  return { ok: false, error: "wrangler dev 启动超时（30s），请稍后在 worker/ 手动执行 pnpm dev" };
}
