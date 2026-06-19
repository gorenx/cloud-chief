import { useState } from "react";
import { useT } from "@/contexts/LocaleContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

/** 本地 / 线上变量行共用列宽：键名 | 值 | 操作位（线上留空占位） */
export const workerVarRowGridClass =
  "grid grid-cols-[10.5rem_minmax(0,1fr)_2rem] items-center gap-x-2";

export function WorkerVarRow({
  k,
  v,
  onChange,
  onRemove,
  readOnly,
  diff,
}: {
  k: string;
  v: string;
  onChange?: (k: string, v: string) => void;
  onRemove?: () => void;
  readOnly?: boolean;
  /** 线上与本地值不一致时高亮值列 */
  diff?: boolean;
}) {
  const t = useT();
  const [key, setKey] = useState(k);
  const [val, setVal] = useState(v);

  const valueClass = cn(
    "min-w-0",
    diff && "border-amber-500/45 ring-1 ring-amber-500/20",
    readOnly && "cursor-default bg-[var(--color-panel)]",
  );
  const keyClass = cn("min-w-0", readOnly && "cursor-default bg-[var(--color-panel)]");

  if (readOnly) {
    return (
      <div
        className={workerVarRowGridClass}
        title={diff ? t("worker.params.valueMismatch") : undefined}
      >
        <Input
          className={keyClass}
          placeholder={t("worker.placeholder.varName")}
          value={k}
          readOnly
          tabIndex={-1}
        />
        <Input
          className={valueClass}
          placeholder={t("worker.placeholder.varValue")}
          value={v}
          readOnly
          tabIndex={-1}
        />
        <div className="h-8 w-8 shrink-0" aria-hidden />
      </div>
    );
  }

  return (
    <div className={workerVarRowGridClass}>
      <Input
        className={keyClass}
        placeholder={t("worker.placeholder.varName")}
        value={key}
        onChange={(e) => {
          setKey(e.target.value);
          onChange?.(e.target.value, val);
        }}
      />
      <Input
        className={valueClass}
        placeholder={t("worker.placeholder.varValue")}
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
          onChange?.(key, e.target.value);
        }}
      />
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 shrink-0 px-0"
        onClick={onRemove}
        aria-label={t("common.delete")}
      >
        ✕
      </Button>
    </div>
  );
}
