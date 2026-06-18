import { useEffect, useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
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
  const { t } = useLocale();
  const [revealed, setRevealed] = useState(Boolean(value));

  useEffect(() => {
    if (value) setRevealed(true);
  }, [value]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        className="max-w-[200px]"
        value={name}
        readOnly={fixed}
        placeholder={t("worker.placeholder.secretName")}
        onChange={(e) => onChange(e.target.value, value)}
      />
      <Input
        className="min-w-[220px] flex-1 font-mono text-xs"
        type={revealed ? "text" : "password"}
        placeholder={fixed ? t("worker.placeholder.secretEmpty") : t("worker.placeholder.secretValue")}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 px-2"
        onClick={() => setRevealed((v) => !v)}
        aria-label={revealed ? t("aria.hideSecret") : t("aria.showSecret")}
      >
        {revealed ? t("btn.common.hide") : t("btn.common.show")}
      </Button>
      <Chip variant={localOk ? "on" : "off"}>
        {localOk ? t("worker.secret.localYes") : t("worker.secret.localNo")}
      </Chip>
      {prodOk !== null && prodOk !== undefined && (
        <Chip variant={prodOk ? "on" : "off"}>
          {prodOk ? t("worker.secret.prodYes") : t("worker.secret.prodNo")}
        </Chip>
      )}
      {optional && (
        <span className="text-[11px] text-[var(--color-muted)]">
          ({t("common.optional")})
        </span>
      )}
      {!fixed && onRemove && (
        <Button variant="ghost" size="sm" onClick={onRemove}>
          ✕
        </Button>
      )}
    </div>
  );
}
