import { Circle } from "lucide-react";
import type { SetupStatus } from "@/lib/setup-flow";

export function SetupFlowUrlPreview({
  accountId,
  status,
}: {
  accountId: string;
  status: SetupStatus;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5">
      <p className="text-xs text-[var(--color-muted)]">三者如何串联（最终请求 URL）</p>
      <p className="mono mt-1 break-all text-xs leading-relaxed">
        <span className="text-[var(--color-muted)]">…/v1/{accountId || "账号"}/</span>
        <span className="text-[var(--color-accent)]">
          {status.defaultGateway || "网关"}
        </span>
        <span className="text-[var(--color-muted)]">/custom-</span>
        <span className="text-emerald-400">{status.defaultSlug || "slug"}</span>
        <span className="text-[var(--color-muted)]">/compatible-mode/v1/…</span>
      </p>
      <p className="mt-1.5 text-xs text-[var(--color-muted)]">
        <Circle className="mr-1 inline h-2 w-2 fill-[var(--color-accent)] text-[var(--color-accent)]" />
        网关 ID
        <Circle className="mx-1 inline h-2 w-2 fill-emerald-400 text-emerald-400" />
        提供商 slug
        <span className="mx-1 text-[var(--color-border)]">·</span>
        上游密钥：BYOK 或请求头 / <code className="mono">.env</code>
      </p>
    </div>
  );
}
