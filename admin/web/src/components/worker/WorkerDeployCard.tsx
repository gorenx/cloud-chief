import { Card } from "@/components/ui/Card";
import { useT } from "@/contexts/LocaleContext";
import { Button } from "@/components/ui/Button";
import type { useSSEStream } from "@/hooks/useSSEStream";

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
  const body = (
    <>
      <div className="flex flex-wrap gap-2">
        <Button disabled={deploy.running} onClick={onDeploy}>
          {t("btn.worker.deploy")}
        </Button>
        <Button variant="ghost" onClick={onRefresh}>
          {t("btn.worker.refreshStatus")}
        </Button>
      </div>
      {deploy.lines.length > 0 && (
        <pre className="mono mt-4 max-h-80 overflow-auto rounded-lg border border-[var(--color-border)] bg-[#0a0d11] p-4 text-xs leading-relaxed text-[#cdd6e4]">
          {deploy.lines.join("\n")}
        </pre>
      )}
    </>
  );

  if (embedded) return body;
  return <Card>{body}</Card>;
}
