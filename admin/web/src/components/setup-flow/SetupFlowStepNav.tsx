import { Link } from "react-router-dom";
import { Check, ChevronRight } from "lucide-react";
import { SETUP_STEPS, type SetupStatus, type SetupStep } from "@/lib/setup-flow";
import { cn } from "@/lib/utils";

function stepMeta(step: SetupStep, status: SetupStatus) {
  if (step === "gateway") {
    return (
      <>
        {status.gatewayCount > 0 ? `已有 ${status.gatewayCount} 个` : "尚未创建"}
        {status.defaultGateway && (
          <>
            {" "}
            · 默认 <code className="mono">{status.defaultGateway}</code>
          </>
        )}
      </>
    );
  }
  if (step === "provider") {
    return (
      <>
        {status.providerCount > 0 ? `已有 ${status.providerCount} 个` : "尚未添加"}
        {status.defaultSlug && (
          <>
            {" "}
            · env <code className="mono">{status.defaultSlug}</code>
          </>
        )}
      </>
    );
  }
  return status.keyCount > 0
    ? `已绑 ${status.keyCount} 个`
    : "未配置（可用 .env DASHSCOPE_API_KEY 代替）";
}

export function SetupFlowStepNav({
  status,
  pageStep,
  current,
}: {
  status: SetupStatus;
  pageStep?: SetupStep;
  current: SetupStep;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
      {SETUP_STEPS.map((step, i) => {
        const done = step.id === "gateway"
          ? status.gatewayDone
          : step.id === "provider"
            ? status.providerDone
            : status.byokDone;
        const isCurrent = pageStep != null && step.id === current;
        const blocked =
          (step.id === "provider" && !status.gatewayDone) ||
          (step.id === "byok" && (!status.gatewayDone || !status.providerDone));

        return (
          <div key={step.id} className="flex min-w-0 flex-1 items-center gap-2">
            {i > 0 && (
              <ChevronRight
                className="hidden h-4 w-4 shrink-0 text-[var(--color-muted)] sm:block"
                aria-hidden
              />
            )}
            <Link
              to={step.to}
              className={cn(
                "flex min-w-0 flex-1 flex-col rounded-lg border px-3 py-2.5 transition-colors",
                isCurrent
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                  : done
                    ? "border-emerald-900/40 bg-emerald-950/20 hover:border-emerald-800/60"
                    : blocked
                      ? "border-[var(--color-border)] opacity-60 hover:opacity-80"
                      : "border-[var(--color-border)] hover:border-[var(--color-accent)]/40",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    done
                      ? "bg-emerald-600 text-white"
                      : isCurrent
                        ? "bg-[var(--color-accent)] text-white"
                        : "bg-[var(--color-panel-elevated)] text-[var(--color-muted)]",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : step.num}
                </span>
                <span className="font-medium">{step.label}</span>
                {step.optional && (
                  <span className="rounded bg-[var(--color-panel-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                    可选
                  </span>
                )}
                {isCurrent && (
                  <span className="text-xs text-[var(--color-accent)]">当前</span>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
                {step.summary}
              </p>
              <p className="mt-1.5 text-xs text-[var(--color-muted)]">
                {stepMeta(step.id, status)}
              </p>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
