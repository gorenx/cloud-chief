import { Circle } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import type { SetupStatus } from "@/lib/setup-flow";

export function SetupFlowUrlPreview({
  accountId,
  status,
}: {
  accountId: string;
  status: SetupStatus;
}) {
  const t = useT();

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5">
      <p className="text-xs text-[var(--color-muted)]">{t("setupFlow.urlPreviewTitle")}</p>
      <p className="mono mt-1 break-all text-xs leading-relaxed">
        <span className="text-[var(--color-muted)]">
          …/v1/{accountId || t("setupFlow.accountPh")}/
        </span>
        <span className="text-[var(--color-accent)]">
          {status.defaultGateway || t("setupFlow.gatewayPh")}
        </span>
        <span className="text-[var(--color-muted)]">/custom-</span>
        <span className="text-emerald-400">{status.defaultSlug || t("setupFlow.slugPh")}</span>
        <span className="text-[var(--color-muted)]">/compatible-mode/v1/…</span>
      </p>
      <p className="mt-1.5 text-xs text-[var(--color-muted)]">
        <Circle className="mr-1 inline h-2 w-2 fill-[var(--color-accent)] text-[var(--color-accent)]" />
        {t("setupFlow.gatewayPh")}
        <Circle className="mx-1 inline h-2 w-2 fill-emerald-400 text-emerald-400" />
        {t("setupFlow.slugPh")}
        <span className="mx-1 text-[var(--color-border)]">·</span>
        {t("setupFlow.urlPreviewLegend")}
      </p>
    </div>
  );
}
