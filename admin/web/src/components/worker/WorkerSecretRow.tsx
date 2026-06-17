import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";

export function WorkerSecretRow({
  name,
  value,
  fixed,
  localOk,
  prodOk,
  optional,
  onChange,
  onRemove,
}: {
  name: string;
  value: string;
  fixed?: boolean;
  localOk?: boolean;
  prodOk?: boolean | null;
  optional?: boolean;
  onChange: (name: string, value: string) => void;
  onRemove?: () => void;
}) {
  const [val, setVal] = useState(value);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        className="max-w-[200px]"
        value={name}
        readOnly={fixed}
        placeholder="Secret 名"
        onChange={(e) => onChange(e.target.value, val)}
      />
      <Input
        type="password"
        placeholder={fixed ? "留空则不改动" : "值"}
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
          onChange(name, e.target.value);
        }}
      />
      <Chip variant={localOk ? "on" : "off"}>本地{localOk ? "✓" : "✗"}</Chip>
      {prodOk !== null && prodOk !== undefined && (
        <Chip variant={prodOk ? "on" : "off"}>生产{prodOk ? "✓" : "✗"}</Chip>
      )}
      {optional && <span className="text-[11px] text-[var(--color-muted)]">(可选)</span>}
      {!fixed && onRemove && (
        <Button variant="ghost" size="sm" onClick={onRemove}>
          ✕
        </Button>
      )}
    </div>
  );
}
