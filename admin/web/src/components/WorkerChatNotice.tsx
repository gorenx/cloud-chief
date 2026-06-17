import type { FieldMetaEntry } from "@/types";
import { SourceBadge } from "./SourceBadge";
import { Button } from "./ui/Button";
import { cn } from "@/lib/utils";
import type { WorkerTarget } from "@/lib/playground-session";

/** Worker 模式：请求路径与本地调试说明 */
export function WorkerChatNotice({
  workerUrl,
  workerTarget,
  workerUrlMeta,
  onHealthCheck,
  healthChecking,
  healthResult,
  hasAdminToken,
}: {
  workerUrl: string;
  workerTarget: WorkerTarget;
  workerUrlMeta?: FieldMetaEntry;
  onHealthCheck: () => void;
  healthChecking: boolean;
  healthResult: string | null;
  hasAdminToken?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div>
        <p className="text-[10px] text-[var(--color-muted)]">
          目标：
          <span className="text-[var(--color-text)]">
            {workerTarget === "local" ? "本地 Worker（:8788）" : "线上 Worker（workers.dev）"}
          </span>
        </p>
        <div className="relative mt-1 min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
          <p className={cn("break-all text-xs text-[var(--color-muted)]", workerUrlMeta && "pr-20")}>
            <code className="mono">POST /api/worker-chat</code> →{" "}
            <code className="mono">{workerUrl}/v1/responses</code>
          </p>
          {workerUrlMeta && (
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
              <SourceBadge meta={workerUrlMeta} />
            </span>
          )}
        </div>
        {workerTarget === "local" && (
          <p className="mt-1 text-[10px] text-[var(--color-muted)]">
            本地需在 <code className="mono">worker/</code> 运行 wrangler dev；顶栏可启动或切换「线上 Worker」。
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" disabled={healthChecking} onClick={onHealthCheck}>
          {healthChecking ? "检查中…" : "GET /health"}
        </Button>
        {healthResult && <span className="text-xs text-[var(--color-muted)]">{healthResult}</span>}
      </div>
      {workerTarget === "local" && !hasAdminToken && (
        <p className="text-[10px] text-amber-200">配置 ADMIN_TOKEN 后可在顶栏一键启动本地 Worker。</p>
      )}
    </div>
  );
}
