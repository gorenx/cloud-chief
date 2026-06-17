import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { SETUP_STEPS, type SetupStatus, type SetupStep } from "@/lib/setup-flow";

export function SetupFlowActions({
  action,
  current,
  currentIdx,
  status,
  coreDone,
  pageStep,
}: {
  action: { text: string; to: string } | null;
  current: SetupStep;
  currentIdx: number;
  status: SetupStatus;
  coreDone: boolean;
  pageStep?: SetupStep;
}) {
  return (
    <>
      {action && (
        <div className="flex flex-wrap items-center gap-2">
          {currentIdx < SETUP_STEPS.length - 1 &&
            !action.text.includes("聊天") &&
            !coreDone && (
              <span className="text-xs text-[var(--color-muted)]">前置未完成 →</span>
            )}
          <Link
            to={action.to}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-accent)]/15 px-3 py-1.5 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25"
          >
            {action.text}
            <ChevronRight className="h-4 w-4" />
          </Link>
          {coreDone && !status.byokDone && current !== "byok" && (
            <Link
              to="/keys"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
            >
              （可选）配置 BYOK
            </Link>
          )}
        </div>
      )}

      {pageStep === "gateway" && !status.gatewayDone && (
        <p className="text-xs text-[var(--color-muted)]">
          建议创建专属命名网关（如 <code className="mono">qwen-gw</code>），并在{" "}
          <code className="mono">.env</code> 设置相同的 <code className="mono">CF_GATEWAY_ID</code>
          。不要使用 Cloudflare 内置 <code className="mono">default</code> 网关。
        </p>
      )}
      {pageStep === "provider" && status.gatewayDone && !status.providerDone && (
        <p className="text-xs text-[var(--color-muted)]">
          slug 创建后需与 <code className="mono">.env</code> 的{" "}
          <code className="mono">PROVIDER_SLUG</code> 一致，否则路由预览会对不上。
        </p>
      )}
    </>
  );
}
