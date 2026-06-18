import { useT } from "@/contexts/LocaleContext";
import { SourceBadge } from "./SourceBadge";
import type { FieldMetaEntry } from "@/types";
import type { PlaygroundDataView } from "@/lib/playground-sources";

export function PlaygroundSourceSummary({ view }: { view: PlaygroundDataView }) {
  const t = useT();

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-[var(--color-muted)]">
      <span className="font-medium text-[var(--color-text)]">{t("playground.sourcesTitle")}</span>
      {view.summary.map((row) => (
        <span key={row.label} className="inline-flex items-center gap-1">
          {row.label}
          <SourceBadge meta={row.meta as FieldMetaEntry} />
        </span>
      ))}
    </div>
  );
}
