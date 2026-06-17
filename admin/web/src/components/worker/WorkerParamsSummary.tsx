import { Chip } from "@/components/ui/Chip";

export interface WorkerSecretSummary {
  name: string;
  configured?: boolean;
  optional?: boolean;
}

export function WorkerParamsSummary({
  vars = {},
  varsLabel = "环境变量",
  compareVars,
  secrets,
  secretsLabel = "Secrets",
  runtime,
}: {
  vars?: Record<string, string>;
  varsLabel?: string;
  compareVars?: Record<string, string>;
  secrets?: WorkerSecretSummary[];
  secretsLabel?: string;
  runtime?: Array<{ label: string; value: string }>;
}) {
  const varEntries = Object.entries(vars).sort(([a], [b]) => a.localeCompare(b));
  const allVarKeys = compareVars
    ? [...new Set([...Object.keys(vars), ...Object.keys(compareVars)])].sort()
    : varEntries.map(([k]) => k);

  return (
    <div className="space-y-3">
      {runtime && runtime.length > 0 && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
            运行配置
          </p>
          <ul className="mt-2 space-y-1">
            {runtime.map(({ label, value }) => (
              <li
                key={label}
                className="flex gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs"
              >
                <span className="shrink-0 text-[var(--color-muted)]">{label}</span>
                <span className="mono text-[var(--color-text)]">{value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(allVarKeys.length > 0 || varEntries.length > 0) && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
            {varsLabel}（{allVarKeys.length || varEntries.length}）
          </p>
          <ul className="mt-2 space-y-1">
            {(compareVars ? allVarKeys : varEntries.map(([k]) => k)).map((key) => {
              const value = vars[key];
              const other = compareVars?.[key];
              const missing = compareVars && value === undefined;
              const extra = compareVars && other === undefined;
              const diff =
                compareVars &&
                value !== undefined &&
                other !== undefined &&
                value !== other;
              return (
                <li
                  key={key}
                  className="flex flex-wrap items-start gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs"
                >
                  <code className="mono shrink-0 font-medium text-[var(--color-muted)]">
                    {key}
                  </code>
                  <span className="mono min-w-0 flex-1 break-all text-[var(--color-text)]">
                    {value ?? <span className="text-[var(--color-muted)]">—</span>}
                  </span>
                  {missing && <Chip variant="warn">仅本地</Chip>}
                  {extra && <Chip variant="warn">仅线上</Chip>}
                  {diff && <Chip variant="warn">值不一致</Chip>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {secrets && secrets.length > 0 && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
            {secretsLabel}（{secrets.length}）
          </p>
          <ul className="mt-2 space-y-1">
            {secrets.map((s) => (
              <li
                key={s.name}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs"
              >
                <code className="mono font-medium text-[var(--color-text)]">{s.name}</code>
                <span className="text-[var(--color-muted)]">••••••</span>
                {s.optional && (
                  <span className="text-[11px] text-[var(--color-muted)]">(可选)</span>
                )}
                <span className="ml-auto flex gap-1">
                  {s.configured === true && <Chip variant="on">生产 ✓</Chip>}
                  {s.configured === false && <Chip variant="off">生产 ✗</Chip>}
                  {s.configured === undefined && (
                    <Chip variant="default">已绑定</Chip>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {varEntries.length === 0 && (!secrets || secrets.length === 0) && !runtime?.length && (
        <p className="text-xs text-[var(--color-muted)]">暂无参数配置</p>
      )}
    </div>
  );
}
