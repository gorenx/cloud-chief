export function formatWorkerFetchError(e: unknown, workerUrl: string): string {
  const err = e as Error & { cause?: { code?: string; message?: string } };
  const msg = err.message ?? String(e);
  const causeCode = err.cause?.code ?? "";
  const refused =
    msg === "fetch failed" ||
    causeCode === "ECONNREFUSED" ||
    msg.includes("ECONNREFUSED");

  if (refused) {
    return [
      `Worker 未响应（${workerUrl}）`,
      "本地：在 worker/ 目录执行 pnpm dev（wrangler dev，默认 :8788）",
      "线上：注释 admin/.env 的 WORKER_URL，有 CF_API_TOKEN 时会用 workers.dev",
    ].join("；");
  }

  return `${msg}（${workerUrl}）`;
}
