import { Link, useLocation } from "react-router-dom";
import { ClickTarget } from "@/components/ui/ClickTarget";
import { useScrollContainer } from "@/contexts/ScrollContainerContext";

const actionButtonClass =
  "rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent-glow)]";

const secondaryLinkClass =
  "rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]";

export type FlowActionTarget = {
  href?: string;
  onClick?: () => void;
  onInPageClick?: () => void;
};

function FlowActionButton({
  href,
  onClick,
  onInPageClick,
  goToLabel,
  focusLabel,
  variant = "primary",
}: FlowActionTarget & {
  goToLabel: string;
  focusLabel: string;
  variant?: "primary" | "secondary";
}) {
  const scrollRef = useScrollContainer();
  const location = useLocation();
  const isSamePage = Boolean(href && location.pathname === href);
  const className = variant === "secondary" ? secondaryLinkClass : actionButtonClass;

  if (isSamePage && onInPageClick) {
    return (
      <ClickTarget onClick={onInPageClick} scrollRef={scrollRef} className={className}>
        {focusLabel}
      </ClickTarget>
    );
  }

  if (href) {
    return (
      <Link to={href} className={className}>
        {goToLabel}
      </Link>
    );
  }

  if (onClick) {
    return (
      <ClickTarget onClick={onClick} scrollRef={scrollRef} className={className}>
        {goToLabel}
      </ClickTarget>
    );
  }

  return null;
}

export function FlowActionBar({
  text,
  goToLabel,
  focusLabel,
  href,
  onClick,
  onInPageClick,
  secondary,
}: {
  text: string;
  goToLabel: string;
  focusLabel: string;
} & FlowActionTarget & {
    secondary?: FlowActionTarget & { text: string };
  }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-panel-elevated)]/40 px-3 py-2.5">
      <p className="text-xs text-[var(--color-muted)]">{text}</p>
      <div className="flex flex-wrap items-center gap-2">
        <FlowActionButton
          href={href}
          onClick={onClick}
          onInPageClick={onInPageClick}
          goToLabel={goToLabel}
          focusLabel={focusLabel}
        />
        {secondary && (
          <FlowActionButton
            href={secondary.href}
            onClick={secondary.onClick}
            onInPageClick={secondary.onInPageClick}
            goToLabel={secondary.text}
            focusLabel={secondary.text}
            variant="secondary"
          />
        )}
      </div>
    </div>
  );
}

export function FlowWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;

  return (
    <ul className="space-y-1.5 rounded-[var(--radius-md)] border border-[var(--color-warn)]/30 bg-[var(--color-warn)]/8 px-3 py-2.5 text-xs text-[var(--color-warn)]">
      {warnings.map((w) => (
        <li key={w}>· {w}</li>
      ))}
    </ul>
  );
}

export function FlowAllDoneMessage({ message }: { message: string }) {
  return <p className="text-xs text-emerald-400">{message}</p>;
}

export const GATEWAY_SETUP_BODY_ID = "gateway-setup-body";

export function focusGatewaySetupBody() {
  requestAnimationFrame(() => {
    document.getElementById(GATEWAY_SETUP_BODY_ID)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  });
}
