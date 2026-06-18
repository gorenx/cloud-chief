import { useState } from "react";
import { useT } from "@/contexts/LocaleContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function WorkerVarRow({
  k,
  v,
  onChange,
  onRemove,
  readOnly,
}: {
  k: string;
  v: string;
  onChange?: (k: string, v: string) => void;
  onRemove?: () => void;
  readOnly?: boolean;
}) {
  const t = useT();
  const [key, setKey] = useState(k);
  const [val, setVal] = useState(v);

  if (readOnly) {
    return (
      <div className="flex gap-2">
        <Input
          className="max-w-[200px] cursor-default bg-[var(--color-panel)]"
          placeholder={t("worker.placeholder.varName")}
          value={k}
          readOnly
          tabIndex={-1}
        />
        <Input
          className="cursor-default bg-[var(--color-panel)]"
          placeholder={t("worker.placeholder.varValue")}
          value={v}
          readOnly
          tabIndex={-1}
        />
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Input
        className="max-w-[200px]"
        placeholder={t("worker.placeholder.varName")}
        value={key}
        onChange={(e) => {
          setKey(e.target.value);
          onChange?.(e.target.value, val);
        }}
      />
      <Input
        placeholder={t("worker.placeholder.varValue")}
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
          onChange?.(key, e.target.value);
        }}
      />
      <Button variant="ghost" size="sm" onClick={onRemove}>
        ✕
      </Button>
    </div>
  );
}
