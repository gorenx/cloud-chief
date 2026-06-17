import type { FieldMetaEntry } from "@/types";
import { SourceBadge } from "./SourceBadge";
import { Button } from "./ui/Button";

/** Worker 模式：经 Supabase JWT 调用边缘代理 */
export function WorkerChatNotice({
  workerUrl,
  supabaseUrl,
  hasTestCredentials,
  workerAuthMeta,
  workerUrlMeta,
  supabaseUrlMeta,
  accessToken,
  onAccessTokenChange,
  onHealthCheck,
  healthChecking,
  healthResult,
}: {
  workerUrl: string;
  supabaseUrl: string | null;
  hasTestCredentials: boolean;
  workerAuthMeta?: FieldMetaEntry;
  workerUrlMeta?: FieldMetaEntry;
  supabaseUrlMeta?: FieldMetaEntry;
  accessToken: string;
  onAccessTokenChange: (v: string) => void;
  onHealthCheck: () => void;
  healthChecking: boolean;
  healthResult: string | null;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div>
        <div className="flex flex-wrap items-center gap-1.5 text-[var(--color-text)]">
          <span className="font-medium">经 Worker</span>
          {workerAuthMeta && <SourceBadge meta={workerAuthMeta} />}
        </div>
        <p className="mt-1 text-[var(--color-muted)]">
          <code className="mono">POST /api/worker-chat</code> →{" "}
          <code className="mono">{workerUrl}/v1/responses</code>
          {workerUrlMeta && <SourceBadge meta={workerUrlMeta} />}
        </p>
        <p className="mt-1 text-[var(--color-muted)]">
          Worker 验 Supabase JWT 后注入网关密钥转发；与直连 Gateway 路径不同。
        </p>
      </div>
      {supabaseUrl && (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-muted)]">
          Supabase：<code className="mono">{supabaseUrl}</code>
          {supabaseUrlMeta && <SourceBadge meta={supabaseUrlMeta} />}
        </p>
      )}
      <div className="space-y-1.5">
        <label className="text-xs text-[var(--color-muted)]">
          access_token（可选，留空则用 admin/.env 测试账号代换）
        </label>
        <input
          type="password"
          value={accessToken}
          onChange={(e) => onAccessTokenChange(e.target.value)}
          placeholder={hasTestCredentials ? "已配置测试账号，可留空" : "粘贴 Supabase access_token"}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-1.5 text-xs outline-none focus:border-[var(--color-accent)]"
        />
        {!hasTestCredentials && !accessToken && (
          <p className="text-xs text-amber-200">
            未配置 SUPABASE_ANON_KEY / TEST_EMAIL / TEST_PASSWORD，请粘贴 token 或填写 admin/.env
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" disabled={healthChecking} onClick={onHealthCheck}>
          {healthChecking ? "检查中…" : "GET /health"}
        </Button>
        {healthResult && <span className="text-xs text-[var(--color-muted)]">{healthResult}</span>}
      </div>
    </div>
  );
}
