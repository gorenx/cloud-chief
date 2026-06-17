import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { useSSEStream } from "@/hooks/useSSEStream";

export function WorkerDeployCard({
  deploy,
  onDeploy,
  onRefresh,
}: {
  deploy: ReturnType<typeof useSSEStream>;
  onDeploy: () => void;
  onRefresh: () => void;
}) {
  return (
    <Card>
      <div className="flex gap-2">
        <Button disabled={deploy.running} onClick={onDeploy}>
          部署 Worker
        </Button>
        <Button variant="ghost" onClick={onRefresh}>
          刷新状态
        </Button>
      </div>
      {deploy.lines.length > 0 && (
        <pre className="mono mt-4 max-h-80 overflow-auto rounded-lg border border-[var(--color-border)] bg-[#0a0d11] p-4 text-xs leading-relaxed text-[#cdd6e4]">
          {deploy.lines.join("\n")}
        </pre>
      )}
    </Card>
  );
}
