import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useAdminToken } from "@/contexts/AdminTokenContext";
import {
  applySupabaseProject,
  disconnectSupabase,
  fetchSupabaseProjects,
  fetchSupabaseStatus,
  saveSupabaseTestCredentials,
  startSupabaseConnect,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { SourceBadge } from "./SourceBadge";
import type { FieldMetaEntry } from "@/types";

function StepBadge({
  n,
  label,
  active,
  done,
}: {
  n: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]",
        done && "bg-emerald-500/15 text-emerald-300",
        active && !done && "bg-[var(--color-accent)]/20 text-[var(--color-text)]",
        !active && !done && "bg-[var(--color-bg)] text-[var(--color-muted)]",
      )}
    >
      <span className="font-mono">{done ? "✓" : n}</span>
      {label}
    </span>
  );
}

export function SupabaseConnectPanel({
  supabaseUrl = null,
  supabaseUrlMeta,
  hasAnonKey = false,
  hasTestCredentials = false,
  testEmail,
  onTestEmailChange,
  testPassword,
  onTestPasswordChange,
  accessToken,
  onAccessTokenChange,
  onApplied,
}: {
  supabaseUrl?: string | null;
  supabaseUrlMeta?: FieldMetaEntry;
  hasAnonKey?: boolean;
  hasTestCredentials?: boolean;
  testEmail: string;
  onTestEmailChange: (v: string) => void;
  testPassword: string;
  onTestPasswordChange: (v: string) => void;
  accessToken: string;
  onAccessTokenChange: (v: string) => void;
  onApplied?: () => void;
}) {
  const { token } = useAdminToken();
  const queryClient = useQueryClient();
  const [selectedRef, setSelectedRef] = useState("");
  const [awaitingTestAccount, setAwaitingTestAccount] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

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
    onSuccess: () => {
      setAwaitingTestAccount(true);
      toast.success("步骤 2 完成：项目配置已写入，请填写测试账号");
      void queryClient.invalidateQueries({ queryKey: ["public-config"] });
      void queryClient.invalidateQueries({ queryKey: ["supabase-projects"] });
      onApplied?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveTestM = useMutation({
    mutationFn: async () => {
      const r = await saveSupabaseTestCredentials(token, testEmail, testPassword);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: () => {
      setAwaitingTestAccount(false);
      toast.success("步骤 3 完成：测试账号已保存，可以开始聊天");
      void queryClient.invalidateQueries({ queryKey: ["public-config"] });
      void queryClient.invalidateQueries({ queryKey: ["supabase-status"] });
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
      setAwaitingTestAccount(false);
      toast.message("已断开 Supabase 平台连接");
      void queryClient.invalidateQueries({ queryKey: ["supabase-status"] });
      void queryClient.invalidateQueries({ queryKey: ["supabase-projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (hasTestCredentials) setAwaitingTestAccount(false);
  }, [hasTestCredentials]);

  useEffect(() => {
    if (!awaitingTestAccount || hasTestCredentials) return;
    emailRef.current?.focus();
  }, [awaitingTestAccount, hasTestCredentials]);

  const status = statusQ.data;
  const projects = projectsQ.data ?? [];
  const appliedProject = useMemo(() => {
    if (!supabaseUrl) return null;
    const ref = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (!ref) return null;
    const fromList = projects.find((p) => p.ref === ref);
    if (fromList) return { name: fromList.name, ref: fromList.ref };
    return { name: ref, ref };
  }, [supabaseUrl, projects]);
  const resolvedTestEmail =
    testEmail.trim() ||
    status?.local_test?.email ||
    status?.account?.test_email ||
    "";
  const showTestAccountInfo = hasTestCredentials || Boolean(resolvedTestEmail);
  const stepConnect = Boolean(status?.connected);
  const stepApply = hasAnonKey && Boolean(supabaseUrl);
  const stepTest = hasTestCredentials;
  const showTestStep = stepApply && !stepTest && (awaitingTestAccount || hasAnonKey);
  const configComplete = stepApply && stepTest;
  const hasSessionAuth =
    Boolean(accessToken.trim()) ||
    hasTestCredentials ||
    (hasAnonKey && testEmail.trim() && testPassword);
  const needsAuth = stepApply && hasAnonKey && !hasSessionAuth;
  const showAuthSection = stepApply && hasAnonKey;

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
    <div className="min-w-0 space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-[var(--color-text)]">Supabase 配置向导</span>
        <span className="text-[10px] text-[var(--color-muted)]">
          {status.connected ? "已授权" : "未授权"} · 本地 OAuth
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <StepBadge n={1} label="授权" active={!stepConnect && !stepApply} done={stepConnect} />
        <StepBadge n={2} label="应用项目" active={!stepApply} done={stepApply} />
        <StepBadge n={3} label="测试账号" active={showTestStep} done={stepTest} />
      </div>

      {(status?.connected && status.account) || showTestAccountInfo || appliedProject || supabaseUrl ? (
        <div className="space-y-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-2.5 py-2 text-xs">
          <p className="text-[10px] text-[var(--color-muted)]">账号信息</p>
          <ul className="space-y-1 text-[var(--color-text)]">
            {status?.connected && status.account && (
              <li className="text-[var(--color-muted)]">
                平台授权已连接 · 可访问 {status.account.projects_count} 个项目
              </li>
            )}
            {supabaseUrl && (
              <li>
                <span className="text-[var(--color-muted)]">项目 URL </span>
                <code className="mono block break-all text-[11px]">{supabaseUrl}</code>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  {supabaseUrlMeta && <SourceBadge meta={supabaseUrlMeta} />}
                  {hasAnonKey && <span className="text-emerald-300">anon key 已配置</span>}
                </div>
              </li>
            )}
            {appliedProject && (
              <li>
                <span className="text-[var(--color-muted)]">已应用项目 </span>
                <span>
                  {appliedProject.name}{" "}
                  <code className="mono text-[11px]">({appliedProject.ref})</code>
                </span>
              </li>
            )}
            {showTestAccountInfo && (
              <>
                <li>
                  <span className="text-[var(--color-muted)]">测试账号邮箱 </span>
                  <code className="mono break-all text-emerald-300">
                    {resolvedTestEmail || "—"}
                  </code>
                </li>
                <li>
                  <span className="text-[var(--color-muted)]">测试账号密码 </span>
                  <span className={hasTestCredentials ? "text-emerald-300" : "text-amber-200"}>
                    {hasTestCredentials ? "已配置（admin/.env）" : "未保存"}
                  </span>
                </li>
              </>
            )}
          </ul>
        </div>
      ) : null}

      {configComplete && (
        <p className="text-xs text-emerald-300">配置已完成，可直接在左侧发送消息。</p>
      )}

      <p className="text-[10px] text-[var(--color-muted)]">
        OAuth 拉取 <code className="mono">SUPABASE_URL</code> 与{" "}
        <code className="mono">anon key</code>；步骤 3 填写 Supabase Auth 用户用于代登录获取 JWT。
      </p>

      {/* 步骤 1 */}
      {!status.connected ? (
        <div className="space-y-2">
          {status.client_id_hint && (
            <p className="text-[10px] text-[var(--color-muted)]">
              client_id: <code className="mono">{status.client_id_hint}</code> · redirect:{" "}
              <code className="mono">{status.redirect_uri}</code>
            </p>
          )}
          <p className="text-[10px] text-[var(--color-muted)]">
            OAuth App 须在{" "}
            <a
              href={status.oauth_apps_url}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-accent)] hover:underline"
            >
              Organization → OAuth Apps
            </a>{" "}
            创建；请用 <code className="mono">http://localhost:5173</code> 打开本页。
          </p>
          <Button
            size="sm"
            disabled={connectM.isPending || !status.local_only}
            onClick={() => connectM.mutate()}
          >
            {connectM.isPending ? "跳转中…" : "① 连接 Supabase"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 步骤 2 */}
          {!stepApply || applyM.isPending ? (
            <div className="space-y-2">
              <p className="text-xs text-[var(--color-muted)]">② 选择项目并写入本地配置</p>
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
            </div>
          ) : (
            <p className="text-xs text-[var(--color-muted)]">
              ② 已应用
              {appliedProject ? `：${appliedProject.name}` : ""}
            </p>
          )}

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

      {showAuthSection && (
        <div className="space-y-2 border-t border-[var(--color-border)] pt-3">
          {!hasTestCredentials && (
            <div
              className={cn(
                "space-y-2 rounded-lg p-2.5",
                showTestStep && "border border-amber-500/40 bg-amber-500/5",
              )}
            >
              {showTestStep && (
                <p className="text-xs font-medium text-amber-100">③ 填写 Supabase 测试账号</p>
              )}
              <p className="text-[10px] text-[var(--color-muted)]">
                Worker 需要用户 JWT，anon key 仅用于代登录。请在 Supabase Authentication 中已有该用户。
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-[var(--color-muted)]">邮箱</label>
                  <input
                    ref={emailRef}
                    type="email"
                    value={testEmail}
                    onChange={(e) => onTestEmailChange(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-1.5 text-xs outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[var(--color-muted)]">密码</label>
                  <input
                    type="password"
                    value={testPassword}
                    onChange={(e) => onTestPasswordChange(e.target.value)}
                    placeholder="Supabase Auth 用户密码"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-1.5 text-xs outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
              </div>
              <Button
                size="sm"
                disabled={!testEmail.trim() || !testPassword || saveTestM.isPending}
                onClick={() => saveTestM.mutate()}
              >
                {saveTestM.isPending ? "保存中…" : "保存测试账号"}
              </Button>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs text-[var(--color-muted)]">
              access_token（可选，已有用户 JWT 时可直接粘贴，跳过测试账号）
            </label>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => onAccessTokenChange(e.target.value)}
              placeholder={
                hasTestCredentials ? "已配置测试账号，可留空" : "或粘贴 Supabase access_token"
              }
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-1.5 text-xs outline-none focus:border-[var(--color-accent)]"
            />
            {needsAuth && (
              <p className="text-xs text-amber-200">请填写并保存测试账号，或粘贴 access_token</p>
            )}
          </div>
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
