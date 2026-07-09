import { RefreshCw } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import type { SyncMeta } from "@/types";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { cn } from "@/lib/utils";

export function SyncStatus({
  meta,
  label,
  onRefresh,
  refreshing = false,
  compact = false,
}: {
  meta?: SyncMeta | null;
  label?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  compact?: boolean;
}) {
  const { t, locale, displayError } = useLocale();
  const source = meta?.source ?? "none";
  const sourceLabel =
    source === "live"
      ? t("common.syncLive")
      : source === "local_snapshot"
        ? t("common.syncSnapshot")
        : t("common.syncNone");
  const variant = source === "live" ? "on" : source === "local_snapshot" ? "warn" : "off";
  const time = meta?.last_synced_at
    ? new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(meta.last_synced_at))
    : null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]",
        !compact &&
          "rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-panel-elevated)]/30 px-3 py-2",
      )}
    >
      {label && <span className="font-medium text-[var(--color-text)]">{label}</span>}
      <Chip variant={variant}>{sourceLabel}</Chip>
      {meta?.stale && <Chip variant="warn">{t("common.syncStale")}</Chip>}
      {time && <span>{t("common.syncLast", { time })}</span>}
      {meta?.error && (
        <span className="min-w-0 break-all text-[var(--color-err)]">
          {t("common.syncError", { error: displayError(meta.error) })}
        </span>
      )}
      {onRefresh && (
        <Button size="sm" variant="ghost" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw className={cn("mr-1.5 size-3.5", refreshing && "animate-spin")} aria-hidden />
          {t("btn.common.refresh")}
        </Button>
      )}
    </div>
  );
}

