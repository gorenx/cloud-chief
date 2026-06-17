import { Check, ChevronDown } from "lucide-react";
import { SETUP_STEPS, stepDone, type SetupStatus, type SetupStep } from "@/lib/setup-flow";
import { cn } from "@/lib/utils";

const SUBTITLE = (
  <>
    前两步必做；BYOK 可选（密钥也可放在 .env 的 <code className="mono">DASHSCOPE_API_KEY</code>）
  </>
);

export function SetupFlowHeader({
  collapsible,
  open,
  onToggle,
  currentStep,
  status,
}: {
  collapsible?: boolean;
  open: boolean;
  onToggle: () => void;
  currentStep?: SetupStep;
  status: SetupStatus;
}) {
  const coreDone = status.gatewayDone && status.providerDone;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 p-4",
        collapsible && !open && "pb-4",
        collapsible && open && "border-b border-[var(--color-border)]",
      )}
    >
      <div className="min-w-0 flex-1">
        {collapsible ? (
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-start gap-2 text-left"
          >
            <ChevronDown
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0 text-[var(--color-muted)] transition-transform",
                !open && "-rotate-90",
              )}
              aria-hidden
            />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">配置流程</h2>
              {!open && (
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-muted)]">
                  {SETUP_STEPS.map((step) => {
                    const done = stepDone(step.id, status);
                    return (
                      <span
                        key={step.id}
                        className={cn(
                          "inline-flex items-center gap-1 rounded px-1.5 py-0.5",
                          currentStep === step.id &&
                            "bg-[var(--color-accent)]/15 text-[var(--color-accent)]",
                          currentStep !== step.id && done && "text-emerald-400",
                        )}
                      >
                        {step.num}. {step.label}
                        {done && <Check className="h-3 w-3" />}
                      </span>
                    );
                  })}
                </p>
              )}
              {open && <p className="mt-0.5 text-xs text-[var(--color-muted)]">{SUBTITLE}</p>}
            </div>
          </button>
        ) : (
          <>
            <h2 className="text-sm font-semibold">配置流程</h2>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">{SUBTITLE}</p>
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {coreDone && (
          <span className="rounded-full bg-emerald-950/50 px-2.5 py-0.5 text-xs text-emerald-400">
            必做步骤已完成
            {status.byokDone ? " · 已配置 BYOK" : ""}
          </span>
        )}
        {collapsible && (
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-panel-elevated)] hover:text-[var(--color-text)]"
          >
            {open ? "收起" : "展开"}
          </button>
        )}
      </div>
    </div>
  );
}
