import { useCallback, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Terminal,
  Network,
  Boxes,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  Rocket,
  Database,
  Settings,
  SlidersHorizontal,
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
      { to: "/playground", labelKey: "nav.playground", icon: Terminal },
    ],
  },
  {
    labelKey: "nav.sectionInfra",
    items: [
      { to: "/gateways", labelKey: "nav.gateways", icon: Network },
      { to: "/providers", labelKey: "nav.providers", icon: Boxes },
      { to: "/keys", labelKey: "nav.keys", icon: KeyRound },
      { to: "/cloudflare-db", labelKey: "nav.cloudflareDb", icon: Database },
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
    items: [
      { to: "/app-config", labelKey: "nav.appConfig", icon: SlidersHorizontal },
      { to: "/settings", labelKey: "nav.settings", icon: Settings },
    ],
  },
];

const NAV_COLLAPSED_KEY = "admin-nav-collapsed";

function readNavCollapsed(): boolean {
  try {
    return localStorage.getItem(NAV_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function AppShell() {
  const { token, user, logout } = useAdminToken();
  const t = useT();
  const scrollRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const isPlayground = pathname.startsWith("/playground");
  const [navCollapsed, setNavCollapsed] = useState(readNavCollapsed);

  const toggleNav = useCallback(() => {
    setNavCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(NAV_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const collapseLabel = navCollapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar");
  const CollapseIcon = navCollapsed ? ChevronRight : ChevronLeft;
  const brandLogoClass = "block size-8 shrink-0";
  const brandToggleClass =
    "flex h-8 w-5 shrink-0 items-center justify-center rounded-md p-0 text-[var(--color-muted)]/75 transition-colors hover:bg-[var(--color-panel-elevated)] hover:text-[var(--color-accent)]";

  return (
    <ScrollContainerContext.Provider value={scrollRef}>
      <div className="app-atmosphere flex h-full overflow-hidden">
        <aside
          className={cn(
            "flex h-full shrink-0 flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-panel)]/80 backdrop-blur-xl transition-[width] duration-200",
            navCollapsed ? "w-12" : "w-52",
          )}
        >
          <div
            className={cn(
              "shrink-0 border-b border-[var(--color-border-subtle)]",
              navCollapsed ? "px-1.5 py-2.5" : "px-2.5 py-3",
            )}
          >
            {navCollapsed ? (
              <div className="flex flex-col items-center gap-1.5">
                <BrandMark className={brandLogoClass} />
                <button
                  type="button"
                  onClick={toggleNav}
                  aria-label={collapseLabel}
                  aria-expanded={!navCollapsed}
                  title={collapseLabel}
                  className={brandToggleClass}
                >
                  <CollapseIcon className="size-4" strokeWidth={2} aria-hidden />
                </button>
              </div>
            ) : (
              <div className="flex h-8 items-center gap-2">
                <BrandMark className={brandLogoClass} />
                <div className="flex h-8 min-w-0 flex-1 flex-col justify-center gap-0.5 leading-none">
                  <span className="truncate font-display text-sm font-semibold tracking-[-0.02em] text-[var(--color-text)]">
                    {t("nav.brandTitle")}
                  </span>
                  <span className="truncate text-[10px] tracking-[0.02em] text-[var(--color-muted)]/85">
                    {t("nav.brandSub")}
                  </span>
                </div>
                <div className="flex h-8 shrink-0 items-center gap-0.5">
                  <span
                    className="h-4 w-px bg-[var(--color-border-subtle)]"
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={toggleNav}
                    aria-label={collapseLabel}
                    aria-expanded={!navCollapsed}
                    title={collapseLabel}
                    className={brandToggleClass}
                  >
                    <CollapseIcon className="size-4" strokeWidth={2} aria-hidden />
                  </button>
                </div>
              </div>
            )}
          </div>

          <nav
            className={cn(
              "min-h-0 flex-1 overflow-y-auto",
              navCollapsed ? "space-y-1 p-1.5" : "space-y-4 p-2.5",
            )}
          >
            {NAV_SECTIONS.map((section, sectionIndex) => (
              <div
                key={section.labelKey}
                className={cn(
                  navCollapsed &&
                    sectionIndex > 0 &&
                    "border-t border-[var(--color-border-subtle)] pt-1",
                )}
              >
                {!navCollapsed && (
                  <div className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]/70">
                    {t(section.labelKey)}
                  </div>
                )}
                <div className="space-y-0.5">
                  {section.items.map(({ to, labelKey, icon: Icon, end }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      title={navCollapsed ? t(labelKey) : undefined}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center rounded-[var(--radius-md)] py-2 text-sm transition-all duration-200",
                          navCollapsed ? "justify-center px-0" : "gap-2 px-2.5",
                          isActive
                            ? "nav-active bg-[var(--color-accent-glow)] font-medium text-[var(--color-accent)]"
                            : "text-[var(--color-muted)] hover:bg-[var(--color-panel-elevated)] hover:text-[var(--color-text)]",
                        )
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-80" />
                      {!navCollapsed && t(labelKey)}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div
            className={cn(
              "shrink-0 border-t border-[var(--color-border-subtle)]",
              navCollapsed ? "p-1.5" : "p-3",
            )}
          >
            {navCollapsed ? (
              token ? (
                <div
                  className="mx-auto h-2 w-2 rounded-full bg-emerald-400"
                  title={user ? user.username : t("nav.tokenOn")}
                />
              ) : (
                <NavLink to="/login" title={t("nav.tokenOff")}>
                  <div className="mx-auto h-2 w-2 rounded-full bg-amber-400" />
                </NavLink>
              )
            ) : token ? (
              <div className="flex items-center justify-between gap-2">
                <Chip variant="on">{user ? user.username : t("nav.tokenOn")}</Chip>
                {user ? (
                  <button
                    type="button"
                    className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
                    onClick={() => void logout()}
                  >
                    {t("login.logout")}
                  </button>
                ) : null}
              </div>
            ) : (
              <NavLink to="/login">
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
