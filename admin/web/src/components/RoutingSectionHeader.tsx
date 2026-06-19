import { useT } from "@/contexts/LocaleContext";
import { SourceBadge } from "./SourceBadge";
import { cn } from "@/lib/utils";

export function RoutingSectionHeader({
  title,
  badge,
  desc,
  className,
}: {
  title: string;
  badge: "CF" | "Worker";
  desc?: string;
  className?: string;
}) {
  const style =
    badge === "CF"
      ? "bg-cyan-950/40 text-[var(--color-ice)] border-cyan-900/40"
      : "bg-[var(--color-accent-glow)] text-[var(--color-accent)] border-[var(--color-accent)]/25";

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-xs font-medium text-[var(--color-text)]">{title}</span>
        <span
          className={cn(
            "inline-flex rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none",
            style,
          )}
        >
          {badge}
        </span>
      </div>
      {desc && <p className="text-[10px] leading-snug text-[var(--color-muted)]">{desc}</p>}
    </div>
  );
}

export function RoutingMismatchNotice({
  cfGateway,
  workerGateway,
  cfSlug,
  workerSlug,
}: {
  cfGateway: string;
  workerGateway: string;
  cfSlug: string;
  workerSlug: string;
}) {
  const t = useT();
  const items: string[] = [];
  if (cfGateway && workerGateway && cfGateway !== workerGateway) {
    items.push(t("routing.mismatchGateway", { cf: cfGateway, worker: workerGateway }));
  }
  if (cfSlug && workerSlug && cfSlug !== workerSlug) {
    items.push(t("routing.mismatchSlug", { cf: cfSlug, worker: workerSlug }));
  }
  if (items.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-warn)]/30 bg-[var(--color-warn)]/8 px-3 py-2 text-xs text-[var(--color-warn)]">
      <p className="font-medium">{t("routing.mismatchTitle")}</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5 opacity-90">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function RoutingSourceLegend({ showWorker = true }: { showWorker?: boolean }) {
  const t = useT();

  return (
    <div className="flex flex-wrap gap-2 text-[10px] text-[var(--color-muted)]">
      <span className="inline-flex items-center gap-1">
        <SourceBadge meta={{ source: "cf" }} />
        {t("routing.cfApiLabel")}
      </span>
      {showWorker && (
        <span className="inline-flex items-center gap-1">
          <SourceBadge meta={{ source: "wrangler" }} />
          worker/wrangler.toml
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <SourceBadge meta={{ source: "derived" }} />
        {t("routing.codeBuildLabel")}
      </span>
    </div>
  );
}
