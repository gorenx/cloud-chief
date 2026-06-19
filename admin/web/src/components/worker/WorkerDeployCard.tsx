import { Card } from "@/components/ui/Card";
import { useT } from "@/contexts/LocaleContext";
import { useScrollContainer } from "@/contexts/ScrollContainerContext";
import type { useSSEStream } from "@/hooks/useSSEStream";
import { cn } from "@/lib/utils";
import { runOnMouseDownWithoutScrollJump } from "@/lib/prevent-nav-scroll";

const primaryActionClass =
  "inline-flex cursor-pointer select-none items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-dim)] disabled:cursor-not-allowed disabled:opacity-50";

const ghostActionClass =
  "inline-flex cursor-pointer select-none items-center justify-center rounded-lg border border-[var(--color-border)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-panel-elevated)]";

export function WorkerDeployCard({
  deploy,
  onDeploy,
  onRefresh,
  embedded,
}: {
  deploy: ReturnType<typeof useSSEStream>;
  onDeploy: () => void;
  onRefresh: () => void;
  embedded?: boolean;
}) {
  const t = useT();
  const scrollRef = useScrollContainer();

  const body = (
    <>
      <div className="flex flex-wrap gap-2">
        <div
          role="button"
          aria-busy={deploy.running}
          aria-disabled={deploy.running}
          className={cn(primaryActionClass, deploy.running && "pointer-events-none opacity-50")}
          onMouseDown={(e) =>
            runOnMouseDownWithoutScrollJump(e, scrollRef, onDeploy, deploy.running)
          }
        >
          {t("btn.worker.deploy")}
        </div>
        <div
          role="button"
          className={ghostActionClass}
          onMouseDown={(e) => runOnMouseDownWithoutScrollJump(e, scrollRef, onRefresh)}
        >
          {t("btn.worker.refreshStatus")}
        </div>
      </div>
      <div className="mt-4 h-80">
        <pre className="mono h-full overflow-auto rounded-lg border border-[var(--color-border)] bg-[#0a0d11] p-4 text-xs leading-relaxed text-[#cdd6e4]">
          {deploy.lines.join("\n")}
        </pre>
      </div>
    </>
  );

  if (embedded) return body;
  return <Card>{body}</Card>;
}
