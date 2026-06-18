import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Hint } from "@/components/ui/Hint";
import {
  fetchWorkerBuildsStatus,
  syncWorkerBuildsConfig,
  triggerWorkerBuild,
} from "@/lib/api";
import { shouldShowBuilderReconfigure, WORKER_CI_HINTS } from "@/lib/worker-builds";
import { WorkerBuilderTokenPanel } from "@/components/worker/WorkerBuilderTokenPanel";
import type { BuildTriggerInfo, WorkerBuildsStatus } from "@/types";

export function WorkerCiCard({
  token,
  workerDir,
  wranglerName,
}: {
  token: string;
  workerDir: string;
  wranglerName: string | null;
}) {
  const qc = useQueryClient();
  const [reconfigureOpen, setReconfigureOpen] = useState(false);

  const buildsQ = useQuery({
    queryKey: ["worker-builds", token, workerDir],
    queryFn: async () => {
      const r = await fetchWorkerBuildsStatus(token, workerDir || undefined);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: Boolean(token && workerDir),
  });

  const syncMut = useMutation({
    mutationFn: async () => {
      const r = await syncWorkerBuildsConfig(token, workerDir || undefined);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: (data) => {
      toast.success(`已同步 Builds 配置：${data.updated.join("、")}`);
      void qc.invalidateQueries({ queryKey: ["worker-builds"] });
    },
    onError: (e) => {
      toast.error(String(e));
      if (/invalid token|authentication error|鉴权失败/i.test(String(e))) {
        setReconfigureOpen(true);
        void qc.invalidateQueries({ queryKey: ["worker-builds"] });
      }
    },
  });

  const triggerMut = useMutation({
    mutationFn: async () => {
      const r = await triggerWorkerBuild(token, workerDir || undefined);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: (data) => {
      toast.success(`已触发构建（${data.trigger_name}）`);
      void qc.invalidateQueries({ queryKey: ["worker-builds"] });
    },
    onError: (e) => {
      toast.error(String(e));
      if (/invalid token|authentication error|鉴权失败/i.test(String(e))) {
        setReconfigureOpen(true);
        void qc.invalidateQueries({ queryKey: ["worker-builds"] });
      }
    },
  });

  const status = buildsQ.data;
  const connected = Boolean(status?.triggers.some((t) => t.repo?.repo_name));
  const showReconfigure =
    reconfigureOpen || Boolean(status && shouldShowBuilderReconfigure(status));
  const tokenInvalid = Boolean(
    status?.token_invalid || (status && shouldShowBuilderReconfigure(status) && status.token_configured),
  );

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <CardTitle desc="Cloudflare Workers Builds · 推送 GitHub 自动部署">
          <span className="inline-flex items-center gap-1.5">
            GitHub / CI 构建
            <Hint content={WORKER_CI_HINTS.section} />
          </span>
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Hint content={WORKER_CI_HINTS.reconfigureToken}>
            <Button variant="ghost" size="sm" onClick={() => setReconfigureOpen(true)}>
              重新配置 Token
            </Button>
          </Hint>
          <Hint content={WORKER_CI_HINTS.refresh}>
            <Button variant="ghost" size="sm" onClick={() => void buildsQ.refetch()}>
              刷新
            </Button>
          </Hint>
        </div>
      </div>

      {buildsQ.isLoading && (
        <p className="text-sm text-[var(--color-muted)]">正在读取 Builds 状态…</p>
      )}
      {buildsQ.isError && (
        <p className="text-sm text-[var(--color-warn)]">{String(buildsQ.error)}</p>
      )}

      {showReconfigure && (
        <div className="mb-4">
          <WorkerBuilderTokenPanel
            adminToken={token}
            configured={Boolean(status?.token_configured && !tokenInvalid)}
            invalidMessage={tokenInvalid && status?.error ? status.error : undefined}
            forceOpen
            onSaved={() => setReconfigureOpen(false)}
          />
        </div>
      )}

      {status && !showReconfigure && (
        <BuildsBody status={status} connected={connected} wranglerName={wranglerName} />
      )}

      {status && showReconfigure && status.ok && (
        <BuildsBody
          status={status}
          connected={connected}
          wranglerName={wranglerName}
          compact
        />
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {status?.dashboard_builds_url && (
          <Hint content={WORKER_CI_HINTS.connectGithub}>
            <a
              href={status.dashboard_builds_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-panel-elevated)]"
            >
              在 Cloudflare 连接 GitHub
            </a>
          </Hint>
        )}
        <Hint content={WORKER_CI_HINTS.syncMonorepo}>
          <Button
            variant="ghost"
            size="sm"
            disabled={!status?.ok || tokenInvalid || syncMut.isPending}
            onClick={() => syncMut.mutate()}
          >
            应用 monorepo 配置
          </Button>
        </Hint>
        <Hint content={WORKER_CI_HINTS.triggerBuild}>
          <Button
            size="sm"
            disabled={!status?.ok || tokenInvalid || !connected || triggerMut.isPending}
            onClick={() => triggerMut.mutate()}
          >
            触发 CI 构建
          </Button>
        </Hint>
      </div>

      <p className="mt-3 text-xs text-[var(--color-muted)]">
        CI 使用 <code className="text-[11px]">CF_WORKER_BUILDER</code>（与 wrangler 用的{" "}
        <code className="text-[11px]">CLOUDFLARE_API_TOKEN</code> 分开）。首次连接 GitHub 须在
        Cloudflare Dashboard 完成 OAuth。
      </p>
    </Card>
  );
}

function BuildsBody({
  status,
  connected,
  wranglerName,
  compact,
}: {
  status: WorkerBuildsStatus;
  connected: boolean;
  wranglerName: string | null;
  compact?: boolean;
}) {
  if (!status.ok) {
    return <p className="text-sm text-[var(--color-warn)]">{status.error}</p>;
  }

  return (
    <div className={`space-y-4 text-sm ${compact ? "mt-4" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Chip variant={connected ? "on" : "off"}>
          GitHub {connected ? "已连接" : "未连接"}
        </Chip>
        {status.cf_script_name && (
          <span className="text-[var(--color-muted)]">
            CF Worker：<code>{status.cf_script_name}</code>
          </span>
        )}
      </div>

      {status.name_mismatch && wranglerName && (
        <p className="rounded-lg border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 px-3 py-2 text-[var(--color-warn)]">
          名称不一致：wrangler.toml 为 <code>{wranglerName}</code>，Cloudflare CI 绑定为{" "}
          <code>{status.cf_script_name}</code>。请在 Dashboard 重命名 Worker 或改回 wrangler
          名称，否则 CI 会覆盖部署名。
        </p>
      )}

      {status.triggers.length === 0 ? (
        <p className="text-[var(--color-muted)]">
          尚无 Builds trigger。点击「在 Cloudflare 连接 GitHub」完成仓库授权与首次配置。
        </p>
      ) : (
        <div className="space-y-3">
          {status.triggers.map((t) => (
            <TriggerBlock key={t.trigger_uuid} trigger={t} />
          ))}
        </div>
      )}

      {status.recent_builds.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--color-muted)]">最近构建</p>
          <ul className="space-y-1 text-xs text-[var(--color-muted)]">
            {status.recent_builds.map((b) => (
              <li key={b.build_uuid} className="font-mono">
                {b.build_outcome ?? "unknown"} · {b.branch ?? "?"} ·{" "}
                {b.commit_hash?.slice(0, 7) ?? "—"} · {formatTime(b.created_on)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TriggerBlock({ trigger }: { trigger: BuildTriggerInfo }) {
  const repo = trigger.repo?.repo_name;
  const owner = trigger.repo?.provider_account_name;
  return (
    <div className="rounded-lg border border-[var(--color-border)] px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{trigger.trigger_name}</span>
        <Chip variant={trigger.is_preview ? "off" : "on"}>
          {trigger.is_preview ? "预览" : "生产"}
        </Chip>
      </div>
      <dl className="mt-2 grid gap-1 text-xs text-[var(--color-muted)]">
        {repo && (
          <div>
            仓库：{owner ? `${owner}/` : ""}
            <code>{repo}</code>
          </div>
        )}
        <div>
          分支：{trigger.branch_includes.join(", ") || "—"}
          {trigger.branch_excludes.length > 0 && `（排除 ${trigger.branch_excludes.join(", ")}）`}
        </div>
        <div>
          Root：<code>{trigger.root_directory || "—"}</code> · Build：{" "}
          <code>{trigger.build_command || "—"}</code>
        </div>
        <div>
          Deploy：<code>{trigger.deploy_command || "—"}</code>
        </div>
        <div>
          Watch paths：include {trigger.path_includes.join(", ") || "—"}
          {trigger.path_excludes.length > 0 && ` · exclude ${trigger.path_excludes.join(", ")}`}
        </div>
      </dl>
    </div>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
