import type { FieldMetaEntry, ModelMeta, RoutingInfo } from "@/types";
import { Card } from "./ui/Card";
import { Chip } from "./ui/Chip";
import { SourceBadge } from "./SourceBadge";

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
  fieldMeta,
  compact,
  showWorker = true,
  workerModel,
}: {
  modelId: string;
  modelMeta: ModelMeta | null;
  routing?: RoutingInfo;
  fieldMeta?: Record<string, FieldMetaEntry>;
  compact?: boolean;
  /** Playground 直连模式可设为 false，隐藏 Worker 默认模型与不一致提示 */
  showWorker?: boolean;
  workerModel?: string | null;
}) {
  const effectiveWorkerModel = workerModel ?? routing?.worker_model ?? null;
  const workerMismatch =
    showWorker && effectiveWorkerModel && effectiveWorkerModel !== modelId
      ? `Worker DEFAULT_MODEL (${effectiveWorkerModel}) 与当前模型不一致`
      : null;

  return (
    <Card className={compact ? "p-4" : ""}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono text-sm font-semibold text-[var(--color-accent)]">{modelId}</span>
        {fieldMeta?.["routing.model"] && (
          <SourceBadge meta={fieldMeta["routing.model"]} />
        )}
        {modelMeta ? (
          <>
            <Chip>{FAMILY_LABEL[modelMeta.family] ?? modelMeta.family}</Chip>
            {modelMeta.supports_thinking && <Chip variant="on">支持思考模式</Chip>}
            {fieldMeta?.model_meta && <SourceBadge meta={fieldMeta.model_meta} />}
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
          <div className="flex items-center gap-1.5">
            <span>
              API 类型：<span className="text-[var(--color-text)]">{routing.api_type}</span>
            </span>
            {fieldMeta?.["routing.api_type"] && (
              <SourceBadge meta={fieldMeta["routing.api_type"]} />
            )}
          </div>
          {showWorker && effectiveWorkerModel && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span>
                Worker 默认模型：<code className="mono">{effectiveWorkerModel}</code>
              </span>
              {fieldMeta?.["routing.worker_model"] && (
                <SourceBadge meta={fieldMeta["routing.worker_model"]} />
              )}
            </div>
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
