import type { ModelMeta, RoutingInfo } from "@/types";
import { Card } from "./ui/Card";
import { Chip } from "./ui/Chip";

const FAMILY_LABEL: Record<string, string> = {
  max: "旗舰 Max",
  plus: "均衡 Plus",
  flash: "快速 Flash",
  coder: "代码 Coder",
  other: "其他",
};

export function ModelDetailCard({
  modelId,
  modelMeta,
  routing,
  compact,
}: {
  modelId: string;
  modelMeta: ModelMeta | null;
  routing?: RoutingInfo;
  compact?: boolean;
}) {
  const workerMismatch =
    routing?.worker_model && routing.worker_model !== modelId
      ? `Worker DEFAULT_MODEL (${routing.worker_model}) 与当前模型不一致`
      : null;

  return (
    <Card className={compact ? "p-4" : ""}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono text-sm font-semibold text-[var(--color-accent)]">{modelId}</span>
        {modelMeta ? (
          <>
            <Chip>{FAMILY_LABEL[modelMeta.family] ?? modelMeta.family}</Chip>
            {modelMeta.supports_thinking && <Chip variant="on">支持思考模式</Chip>}
          </>
        ) : (
          <Chip variant="warn">不在已知目录中</Chip>
        )}
      </div>
      {modelMeta && (
        <p className="mt-2 text-sm text-[var(--color-text)]">{modelMeta.display_name}</p>
      )}
      {!compact && modelMeta?.notes && (
        <p className="mt-2 text-xs text-[var(--color-muted)]">{modelMeta.notes}</p>
      )}
      {routing && (
        <div className="mt-3 space-y-1 text-xs text-[var(--color-muted)]">
          <div>API 类型：<span className="text-[var(--color-text)]">{routing.api_type}</span></div>
          {routing.worker_model && (
            <div>Worker 默认模型：<code className="mono">{routing.worker_model}</code></div>
          )}
        </div>
      )}
      {workerMismatch && (
        <p className="mt-2 text-xs text-[var(--color-warn)]">⚠ {workerMismatch}</p>
      )}
      {!modelMeta && (
        <p className="mt-2 text-xs text-[var(--color-warn)]">
          Responses API 不支持无版本 qwen-max；请确认模型 ID 正确。
        </p>
      )}
    </Card>
  );
}
