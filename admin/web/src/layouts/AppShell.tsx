import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Network,
  Boxes,
  KeyRound,
  Rocket,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import { Chip } from "@/components/ui/Chip";

const nav = [
  { to: "/", label: "概览", icon: LayoutDashboard, end: true },
  { to: "/playground", label: "聊天调试", icon: MessageSquare },
  { to: "/gateways", label: "网关", icon: Network },
  { to: "/providers", label: "提供商", icon: Boxes },
  { to: "/keys", label: "BYOK 密钥", icon: KeyRound },
  { to: "/worker", label: "Worker 部署", icon: Rocket },
  { to: "/settings", label: "设置", icon: Settings },
];

export function AppShell() {
  const { token } = useAdminToken();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-panel)]">
        <div className="border-b border-[var(--color-border)] px-4 py-5">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Cloud Chief
          </div>
          <div className="mt-1 text-sm font-semibold">AI Gateway Admin</div>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {nav.map(({ to, label, icon: Icon, end }) => (
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
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-[var(--color-border)] p-4">
          {token ? (
            <Chip variant="on">已配置令牌</Chip>
          ) : (
            <Chip variant="warn">未配置令牌</Chip>
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
