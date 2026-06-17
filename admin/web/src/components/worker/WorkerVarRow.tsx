import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function WorkerVarRow({
  k,
  v,
  onChange,
  onRemove,
}: {
  k: string;
  v: string;
  onChange: (k: string, v: string) => void;
  onRemove: () => void;
}) {
  const [key, setKey] = useState(k);
  const [val, setVal] = useState(v);
  return (
    <div className="flex gap-2">
      <Input
        className="max-w-[200px]"
        placeholder="变量名"
        value={key}
        onChange={(e) => {
          setKey(e.target.value);
          onChange(e.target.value, val);
        }}
      />
      <Input
        placeholder="值"
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
          onChange(key, e.target.value);
        }}
      />
      <Button variant="ghost" size="sm" onClick={onRemove}>
        ✕
      </Button>
    </div>
  );
}
