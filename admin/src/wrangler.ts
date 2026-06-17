import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { env, workerDir } from "./env";

const NPX = process.platform === "win32" ? "npx.cmd" : "npx";

function childEnv(): NodeJS.ProcessEnv {
  const e = { ...process.env };
  if (env.CLOUDFLARE_API_TOKEN) e.CLOUDFLARE_API_TOKEN = env.CLOUDFLARE_API_TOKEN;
  return e;
}

export function spawnWrangler(
  args: string[],
  cwd: string = workerDir,
): ChildProcessWithoutNullStreams {
  return spawn(NPX, ["wrangler", ...args], { cwd, env: childEnv() });
}

export interface RunResult {
  code: number;
  output: string;
}

/** 跑一条 wrangler 命令，收集 stdout+stderr，可选 stdin（用于 secret put）。 */
export function runWrangler(
  args: string[],
  opts: { input?: string; cwd?: string } = {},
): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawnWrangler(args, opts.cwd);
    let output = "";
    child.stdout.on("data", (d: Buffer) => (output += d.toString()));
    child.stderr.on("data", (d: Buffer) => (output += d.toString()));
    child.on("error", (e) => resolve({ code: -1, output: `${output}\n${e.message}` }));
    child.on("close", (code) => resolve({ code: code ?? -1, output }));
    if (opts.input !== undefined) {
      child.stdin.write(opts.input);
      child.stdin.end();
    }
  });
}
