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
      ? "bg-violet-950/40 text-violet-300 border-violet-900/50"
      : "bg-orange-950/40 text-orange-300 border-orange-900/50";

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-[var(--color-text)]">{title}</span>
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
  const items: string[] = [];
  if (cfGateway && workerGateway && cfGateway !== workerGateway) {
    items.push(`gateway：CF 默认「${cfGateway}」≠ Worker「${workerGateway}」`);
  }
  if (cfSlug && workerSlug && cfSlug !== workerSlug) {
    items.push(`provider_slug：CF 默认「${cfSlug}」≠ Worker「${workerSlug}」`);
  }
  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
      <p className="font-medium">CF 默认与 Worker 配置不一致</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-amber-200/90">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

export function RoutingSourceLegend({ showWorker = true }: { showWorker?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2 text-[10px] text-[var(--color-muted)]">
      <span className="inline-flex items-center gap-1">
        <SourceBadge meta={{ source: "cf" }} />
        Cloudflare API / 控制台
      </span>
      {showWorker && (
        <span className="inline-flex items-center gap-1">
          <SourceBadge meta={{ source: "wrangler" }} />
          worker/wrangler.toml
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <SourceBadge meta={{ source: "derived" }} />
        代码拼接
      </span>
    </div>
  );
}
