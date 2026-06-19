import { KeyRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useT } from "@/contexts/LocaleContext";
import type { MessageKey } from "@/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

export function NoTokenPrompt({
  className,
  suffixKey = "common.noTokenSuffix",
}: {
  className?: string;
  suffixKey?: MessageKey;
}) {
  const t = useT();
  return (
    <div
      className={cn(
        "glass-panel flex flex-col items-start gap-4 rounded-[var(--radius-xl)] p-6 sm:flex-row sm:items-center",
        className,
      )}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-warn)]/12 ring-1 ring-[var(--color-warn)]/25">
        <KeyRound className="h-5 w-5 text-[var(--color-warn)]" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-semibold text-[var(--color-text)]">
          {t("common.noTokenPrefix")} {t("common.settingsLink")}
        </p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{t(suffixKey)}</p>
      </div>
      <Link to="/settings" className="shrink-0">
        <Button variant="primary" size="sm">
          {t("common.settingsLink")}
        </Button>
      </Link>
    </div>
  );
}
