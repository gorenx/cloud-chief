import type { FieldMetaEntry } from "@/types";
import { useT } from "@/contexts/LocaleContext";
import { SourceBadge } from "./SourceBadge";
import { Button } from "./ui/Button";
import { cn } from "@/lib/utils";
import { workerEndpointSummary, isLocalWorkerEndpoint } from "@/components/WorkerEndpointSelect";
import type { WorkerTarget } from "@/lib/playground-session";
import type { WorkerEndpointOption } from "@admin/worker-endpoints";

/** Worker 模式：请求路径与本地调试说明 */
export function WorkerChatNotice({
  workerUrl,
  workerTarget,
  workerEndpoints,
  workerUrlMeta,
  onHealthCheck,
  healthChecking,
  healthResult,
  hasAdminToken,
}: {
  workerUrl: string;
  workerTarget: WorkerTarget;
  workerEndpoints?: WorkerEndpointOption[];
  workerUrlMeta?: FieldMetaEntry;
  onHealthCheck: () => void;
  healthChecking: boolean;
  healthResult: string | null;
  hasAdminToken?: boolean;
}) {
  const t = useT();

  return (
    <div className="min-w-0 space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div>
        <p className="text-[10px] text-[var(--color-muted)]">
          {t("playground.target")}
          <span className="text-[var(--color-text)]">
            {workerEndpointSummary(t, workerTarget, workerEndpoints)}
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
        {isLocalWorkerEndpoint(workerTarget) && (
          <p className="mt-1 text-[10px] text-[var(--color-muted)]">{t("playground.localDevHint")}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" disabled={healthChecking} onClick={onHealthCheck}>
          {healthChecking ? t("playground.checking") : t("playground.healthCheck")}
        </Button>
        {healthResult && <span className="text-xs text-[var(--color-muted)]">{healthResult}</span>}
      </div>
      {isLocalWorkerEndpoint(workerTarget) && !hasAdminToken && (
        <p className="text-[10px] text-amber-200">{t("playground.adminTokenHint")}</p>
      )}
    </div>
  );
}
