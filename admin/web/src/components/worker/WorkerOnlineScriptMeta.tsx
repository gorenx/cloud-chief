import type { CfDeployedWorker } from "@/types";

export function WorkerOnlineScriptMeta({ script }: { script: CfDeployedWorker }) {
  const meta = [
    script.compatibility_date && `compatibility_date=${script.compatibility_date}`,
    script.usage_model && `usage_model=${script.usage_model}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <p className="whitespace-nowrap text-xs text-[var(--color-muted)]">
      script: <code className="mono">{script.name}</code>
      {meta && <> · {meta}</>}
    </p>
  );
}
