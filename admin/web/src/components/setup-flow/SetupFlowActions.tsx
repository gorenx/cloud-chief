import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import { SETUP_STEPS, type SetupStatus, type SetupStep, type SetupActionKey } from "@/lib/setup-flow";

const PLAYGROUND_ACTION: SetupActionKey = "goPlayground";

export function SetupFlowActions({
  action,
  current,
  currentIdx,
  status,
  coreDone,
  pageStep,
  formatAction,
}: {
  action: { key: SetupActionKey; to: string } | null;
  current: SetupStep;
  currentIdx: number;
  status: SetupStatus;
  coreDone: boolean;
  pageStep?: SetupStep;
  formatAction: (key: SetupActionKey) => string;
}) {
  const t = useT();

  return (
    <>
      {action && (
        <div className="flex flex-wrap items-center gap-2">
          {currentIdx < SETUP_STEPS.length - 1 &&
            action.key !== PLAYGROUND_ACTION &&
            !coreDone && (
              <span className="text-xs text-[var(--color-muted)]">{t("common.prerequisite")}</span>
            )}
          <Link
            to={action.to}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-accent)]/15 px-3 py-1.5 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25"
          >
            {formatAction(action.key)}
            <ChevronRight className="h-4 w-4" />
          </Link>
          {coreDone && !status.byokDone && current !== "byok" && (
            <Link
              to="/keys"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
            >
              {t("setupFlow.optionalByok")}
            </Link>
          )}
        </div>
      )}

      {pageStep === "gateway" && !status.gatewayDone && (
        <p className="text-xs text-[var(--color-muted)]">{t("setupFlow.hintGateway")}</p>
      )}
      {pageStep === "provider" && status.gatewayDone && !status.providerDone && (
        <p className="text-xs text-[var(--color-muted)]">{t("setupFlow.hintProvider")}</p>
      )}
    </>
  );
}
