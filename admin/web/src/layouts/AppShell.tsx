import { useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
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
import { BrandMark } from "@/components/ui/BrandMark";
import { ScrollContainerContext } from "@/contexts/ScrollContainerContext";
import type { MessageKey } from "@/i18n";

type NavItem = {
  to: string;
  labelKey: MessageKey;
  icon: typeof LayoutDashboard;
  end?: boolean;
};

type NavSection = {
  labelKey: MessageKey;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    labelKey: "nav.sectionMonitor",
    items: [
      { to: "/", labelKey: "nav.overview", icon: LayoutDashboard, end: true },
      { to: "/playground", labelKey: "nav.playground", icon: MessageSquare },
    ],
  },
  {
    labelKey: "nav.sectionInfra",
    items: [
      { to: "/gateways", labelKey: "nav.gateways", icon: Network },
      { to: "/providers", labelKey: "nav.providers", icon: Boxes },
      { to: "/keys", labelKey: "nav.keys", icon: KeyRound },
    ],
  },
  {
    labelKey: "nav.sectionDeploy",
    items: [
      { to: "/worker", labelKey: "nav.worker", icon: Rocket },
      { to: "/supabase", labelKey: "nav.supabase", icon: Database },
    ],
  },
  {
    labelKey: "nav.sectionSystem",
    items: [{ to: "/settings", labelKey: "nav.settings", icon: Settings }],
  },
];

export function AppShell() {
  const { token } = useAdminToken();
  const t = useT();
  const scrollRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const isPlayground = pathname.startsWith("/playground");

  return (
    <ScrollContainerContext.Provider value={scrollRef}>
      <div className="app-atmosphere flex h-full overflow-hidden">
        <aside className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-[var(--color-border-subtle)] bg-[var(--color-panel)]/80 backdrop-blur-xl">
          <div className="border-b border-[var(--color-border-subtle)] px-4 py-5">
            <div className="flex items-center gap-3">
              <BrandMark className="h-9 w-9 shrink-0" />
              <div className="min-w-0">
                <div className="font-display text-sm font-semibold tracking-tight">
                  {t("nav.brandTitle")}
                </div>
                <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  {t("nav.brandSub")}
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-5 p-3">
            {NAV_SECTIONS.map((section) => (
              <div key={section.labelKey}>
                <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]/70">
                  {t(section.labelKey)}
                </div>
                <div className="space-y-0.5">
                  {section.items.map(({ to, labelKey, icon: Icon, end }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-sm transition-all duration-200",
                          isActive
                            ? "nav-active bg-[var(--color-accent-glow)] font-medium text-[var(--color-accent)]"
                            : "text-[var(--color-muted)] hover:bg-[var(--color-panel-elevated)] hover:text-[var(--color-text)]",
                        )
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-80" />
                      {t(labelKey)}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-[var(--color-border-subtle)] p-4">
            {token ? (
              <Chip variant="on">{t("nav.tokenOn")}</Chip>
            ) : (
              <NavLink to="/settings">
                <Chip variant="warn">{t("nav.tokenOff")}</Chip>
              </NavLink>
            )}
          </div>
        </aside>

        <main
          ref={scrollRef}
          data-app-scroll
          className="min-h-0 flex-1 overflow-y-auto [overflow-anchor:none]"
        >
          <div
            className={cn(
              "mx-auto",
              isPlayground ? "h-full max-w-none p-4 lg:p-5" : "max-w-6xl p-6 lg:p-8",
            )}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </ScrollContainerContext.Provider>
  );
}
