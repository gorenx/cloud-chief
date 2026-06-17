import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import {
  applySupabaseProject,
  disconnectSupabase,
  fetchSupabaseProjects,
  fetchSupabaseStatus,
  startSupabaseConnect,
} from "@/lib/api";
import { useState } from "react";

export function SupabaseConnectPanel({ onApplied }: { onApplied?: () => void }) {
  const { token } = useAdminToken();
  const queryClient = useQueryClient();
  const [selectedRef, setSelectedRef] = useState("");

  const statusQ = useQuery({
    queryKey: ["supabase-status", token],
    queryFn: async () => {
      const r = await fetchSupabaseStatus(token);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token),
  });

  const projectsQ = useQuery({
    queryKey: ["supabase-projects", token],
    queryFn: async () => {
      const r = await fetchSupabaseProjects(token);
      if (!r.ok) throw new Error(r.error);
      return r.data.projects;
    },
    enabled: Boolean(token && statusQ.data?.connected),
  });

  const connectM = useMutation({
    mutationFn: async () => {
      const r = await startSupabaseConnect(token);
      if (!r.ok) throw new Error(r.error);
      return r.data.url;
    },
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyM = useMutation({
    mutationFn: async (ref: string) => {
      const r = await applySupabaseProject(token, ref);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: (data) => {
      toast.success(`已写入 ${data.applied.supabase_url}`);
      void queryClient.invalidateQueries({ queryKey: ["public-config"] });
      onApplied?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnectM = useMutation({
    mutationFn: async () => {
      const r = await disconnectSupabase(token);
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.message("已断开 Supabase 平台连接");
      void queryClient.invalidateQueries({ queryKey: ["supabase-status"] });
      void queryClient.invalidateQueries({ queryKey: ["supabase-projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = statusQ.data;
  const projects = projectsQ.data ?? [];

  if (!token) {
    return (
      <p className="text-xs text-amber-200">
        请先在设置页配置 ADMIN_TOKEN，才能连接 Supabase。
      </p>
    );
  }

  if (!status?.oauth_configured) {
    return (
      <p className="text-xs text-[var(--color-muted)]">
        维护者需在 <code className="mono">admin/.env</code> 配置{" "}
        <code className="mono">SUPABASE_OAUTH_*</code>（Organization OAuth App，仅配一次）。
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-[var(--color-text)]">Supabase 项目配置</span>
        <span className="text-[10px] text-[var(--color-muted)]">
          {status.connected ? "已授权" : "未授权"} · 本地 OAuth
        </span>
      </div>
      <p className="text-[10px] text-[var(--color-muted)]">
        通过 Supabase 平台 OAuth 拉取 <code className="mono">SUPABASE_URL</code> 与{" "}
        <code className="mono">anon key</code>，写入 wrangler 与 admin/.env（PKCE + httpOnly
        cookie）。
      </p>
      {!status.connected ? (
        <Button
          size="sm"
          disabled={connectM.isPending || !status.local_only}
          onClick={() => connectM.mutate()}
        >
          {connectM.isPending ? "跳转中…" : "连接 Supabase"}
        </Button>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Select
              value={selectedRef}
              onChange={(e) => setSelectedRef(e.target.value)}
              className="min-w-[160px] flex-1 text-xs"
            >
              <option value="">选择项目…</option>
              {projects.map((p) => (
                <option key={p.ref} value={p.ref}>
                  {p.name} ({p.ref})
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              disabled={!selectedRef || applyM.isPending}
              onClick={() => applyM.mutate(selectedRef)}
            >
              {applyM.isPending ? "写入中…" : "应用配置"}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={disconnectM.isPending}
            onClick={() => disconnectM.mutate()}
          >
            断开连接
          </Button>
        </div>
      )}
      {!status.local_only && (
        <p className="text-xs text-amber-200">
          当前 ADMIN_BIND 非本机回环地址，已禁用 OAuth 连接。
        </p>
      )}
    </div>
  );
}
