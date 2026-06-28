import type { CfDeployedWorker } from "@/types";
import { cn } from "@/lib/utils";

export function WorkerOnlineScriptMeta({
  script,
  className,
}: {
  script: CfDeployedWorker;
  className?: string;
}) {
  const meta = [
    script.compatibility_date && `compatibility_date=${script.compatibility_date}`,
    script.usage_model && `usage_model=${script.usage_model}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <p className={cn("text-xs leading-snug text-[var(--color-muted)]", className)}>
      script: <code className="mono">{script.name}</code>
      {meta && <> · {meta}</>}
    </p>
  );
}
