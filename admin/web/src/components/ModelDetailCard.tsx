import type { FieldMetaEntry, ModelMeta, RoutingInfo } from "@/types";
import { useT } from "@/contexts/LocaleContext";
import type { MessageKey } from "@/i18n";
import { Card } from "./ui/Card";
import { Chip } from "./ui/Chip";
import { SourceBadge } from "./SourceBadge";

const FAMILY_LABEL_KEYS: Record<string, MessageKey> = {
  max: "model.family.max",
  plus: "model.family.plus",
  flash: "model.family.flash",
  coder: "model.family.coder",
  other: "model.family.other",
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
  const t = useT();
  const effectiveWorkerModel = workerModel ?? routing?.worker_model ?? null;
  const workerMismatch =
    showWorker && effectiveWorkerModel && effectiveWorkerModel !== modelId
      ? t("model.workerMismatch", { workerModel: effectiveWorkerModel })
      : null;

  const familyLabel = modelMeta
    ? t(FAMILY_LABEL_KEYS[modelMeta.family] ?? "model.family.other")
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
            <Chip>{familyLabel}</Chip>
            {modelMeta.supports_thinking && <Chip variant="on">{t("model.supportsThinking")}</Chip>}
            {fieldMeta?.model_meta && <SourceBadge meta={fieldMeta.model_meta} />}
          </>
        ) : (
          <Chip variant="warn">{t("model.notInCatalog")}</Chip>
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
              {t("model.apiType")}：<span className="text-[var(--color-text)]">{routing.api_type}</span>
            </span>
            {fieldMeta?.["routing.api_type"] && (
              <SourceBadge meta={fieldMeta["routing.api_type"]} />
            )}
          </div>
          {showWorker && effectiveWorkerModel && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span>
                {t("model.workerDefaultModel")}：<code className="mono">{effectiveWorkerModel}</code>
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
        <p className="mt-2 text-xs text-[var(--color-warn)]">{t("model.noVersionWarn")}</p>
      )}
    </Card>
  );
}
