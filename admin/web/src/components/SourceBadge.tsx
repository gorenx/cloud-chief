import type { FieldMetaEntry, FieldSource } from "@/types";
import { useT } from "@/contexts/LocaleContext";
import type { MessageKey } from "@/i18n";
import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

const SOURCE_LABEL_KEYS: Record<FieldSource, MessageKey> = {
  env: "source.env",
  cf: "source.cf",
  wrangler: "source.wrangler",
  catalog: "source.catalog",
  derived: "source.derived",
};

const SOURCE_STYLE: Record<FieldSource, string> = {
  env: "bg-sky-950/50 text-sky-300",
  cf: "bg-violet-950/50 text-violet-300",
  wrangler: "bg-orange-950/50 text-orange-300",
  catalog: "bg-teal-950/50 text-teal-300",
  derived: "bg-[var(--color-panel-elevated)] text-[var(--color-muted)]",
};

export function SourceBadge({ meta }: { meta?: FieldMetaEntry }) {
  const t = useT();
  if (!meta) return null;

  const sourceLabel = t(SOURCE_LABEL_KEYS[meta.source]);
  const parts: string[] = [];
  if (meta.key) parts.push(meta.key);
  if (meta.hint) parts.push(meta.hint);
  if (meta.dependsOn?.length) {
    parts.push(`${t("routing.dependsOn")}: ${meta.dependsOn.join(", ")}`);
  }
  const title = parts.join(" · ") || sourceLabel;

  return (
    <span
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none",
        SOURCE_STYLE[meta.source],
      )}
    >
      {sourceLabel}
    </span>
  );
}

export function FieldLabel({
  label,
  meta,
}: {
  label: string;
  meta?: FieldMetaEntry;
}) {
  if (!label && !meta) return null;
  return (
    <div className="flex items-center gap-1.5">
      {label ? (
        <span className="text-xs text-[var(--color-muted)]">{label}</span>
      ) : null}
      {meta ? <SourceBadge meta={meta} /> : null}
    </div>
  );
}

export function SelectWithSourceBadge({
  meta,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { meta?: FieldMetaEntry }) {
  const badgePad =
    meta?.source === "env" ? "pr-[6.5rem]" : meta ? "pr-[4.5rem]" : "pr-8";

  return (
    <div
      className={cn(
        "relative min-w-0 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] focus-within:border-[var(--color-accent)]",
        props.disabled && "opacity-60",
      )}
    >
      <select
        className={cn(
          "w-full rounded-lg border-0 bg-transparent py-2 pl-3 text-sm text-[var(--color-text)] outline-none",
          badgePad,
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {meta && (
        <span className="pointer-events-none absolute right-7 top-1/2 -translate-y-1/2">
          <SourceBadge meta={meta} />
        </span>
      )}
    </div>
  );
}

export function InputWithSourceBadge({
  meta,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { meta?: FieldMetaEntry }) {
  const badgePad =
    meta?.source === "env" ? "pr-[6.5rem]" : meta ? "pr-[4.5rem]" : "pr-3";

  return (
    <div
      className={cn(
        "relative min-w-0 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] focus-within:border-[var(--color-accent)]",
        props.disabled && "opacity-60",
      )}
    >
      <input
        className={cn(
          "w-full rounded-lg border-0 bg-transparent py-2 pl-3 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-muted)]/60",
          badgePad,
          className,
        )}
        {...props}
      />
      {meta && (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
          <SourceBadge meta={meta} />
        </span>
      )}
    </div>
  );
}
