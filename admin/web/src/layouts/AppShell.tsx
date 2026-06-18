import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Network,
  Boxes,
  KeyRound,
  Rocket,
  Database,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { useT } from "@/contexts/LocaleContext";
import { Chip } from "@/components/ui/Chip";
import type { MessageKey } from "@/i18n";

const NAV_ITEMS: { to: string; labelKey: MessageKey; icon: typeof LayoutDashboard; end?: boolean }[] = [
  { to: "/", labelKey: "nav.overview", icon: LayoutDashboard, end: true },
  { to: "/playground", labelKey: "nav.playground", icon: MessageSquare },
  { to: "/gateways", labelKey: "nav.gateways", icon: Network },
  { to: "/providers", labelKey: "nav.providers", icon: Boxes },
  { to: "/keys", labelKey: "nav.keys", icon: KeyRound },
  { to: "/worker", labelKey: "nav.worker", icon: Rocket },
  { to: "/supabase", labelKey: "nav.supabase", icon: Database },
  { to: "/settings", labelKey: "nav.settings", icon: Settings },
];

export function AppShell() {
  const { token } = useAdminToken();
  const t = useT();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-panel)]">
        <div className="border-b border-[var(--color-border)] px-4 py-5">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
            {t("nav.brandSub")}
          </div>
          <div className="mt-1 text-sm font-semibold">{t("nav.brandTitle")}</div>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {NAV_ITEMS.map(({ to, labelKey, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                    : "text-[var(--color-muted)] hover:bg-[var(--color-panel-elevated)] hover:text-[var(--color-text)]",
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-[var(--color-border)] p-4">
          {token ? (
            <Chip variant="on">{t("nav.tokenOn")}</Chip>
          ) : (
            <Chip variant="warn">{t("nav.tokenOff")}</Chip>
          )}
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
