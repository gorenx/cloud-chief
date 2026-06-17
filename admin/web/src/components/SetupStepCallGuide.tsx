import type { SetupStep } from "@/lib/setup-flow";
import { buildInvokeUrl } from "@/lib/api";

export interface SetupCallGuideOverrides {
  gatewayId?: string;
  providerSlug?: string;
  model?: string;
  byokConfigured?: boolean;
  gatewayAuthenticated?: boolean;
}

export interface SetupStepCallGuideProps {
  step: SetupStep;
  accountId: string;
  gatewayId: string;
  providerSlug: string;
  path: string;
  model: string;
  byokConfigured?: boolean;
  gatewayAuthenticated?: boolean;
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mono overflow-x-auto rounded border border-[var(--color-border)] bg-black/25 p-2.5 text-[11px] leading-relaxed text-[var(--color-text)]">
      {children}
    </pre>
  );
}

function curlExample(
  url: string,
  model: string,
  headers: string[],
  note?: string,
): string {
  const headerLines = headers.map((h) => `  -H '${h}' \\`).join("\n");
  return `curl -X POST '${url}' \\
${headerLines}
  -d '{"model":"${model}","input":[{"role":"user","content":"你好"}],"stream":true}'${note ? `\n\n# ${note}` : ""}`;
}

function UrlLine({
  accountId,
  gatewayId,
  providerSlug,
  highlight,
}: {
  accountId: string;
  gatewayId: string;
  providerSlug: string;
  highlight: SetupStep;
}) {
  const gw = gatewayId || "网关ID";
  const slug = providerSlug || "slug";
  return (
    <p className="mono mt-1 break-all text-xs leading-relaxed">
      <span className="text-[var(--color-muted)]">
        https://gateway.ai.cloudflare.com/v1/{accountId || "账号"}/
      </span>
      <span
        className={
          highlight === "gateway"
            ? "rounded bg-[var(--color-accent)]/25 px-0.5 text-[var(--color-accent)]"
            : "text-[var(--color-accent)]"
        }
      >
        {gw}
      </span>
      <span className="text-[var(--color-muted)]">/custom-</span>
      <span
        className={
          highlight === "provider"
            ? "rounded bg-emerald-500/20 px-0.5 text-emerald-400"
            : highlight === "byok"
              ? "text-emerald-400"
              : "text-[var(--color-muted)]"
        }
      >
        {slug}
      </span>
      <span className="text-[var(--color-muted)]">/compatible-mode/v1/…</span>
    </p>
  );
}

function ByokComparison({
  url,
  model,
  hasUrl,
  byokConfigured,
  gatewayAuthenticated,
}: {
  url: string;
  model: string;
  hasUrl: boolean;
  byokConfigured: boolean;
  gatewayAuthenticated?: boolean;
}) {
  const gatewayAuthHeader =
    "cf-aig-authorization: Bearer $CF_AIG_TOKEN  # 网关已开启鉴权时必填";

  const beforeHeaders = [
    "Content-Type: application/json",
    "Authorization: Bearer $DASHSCOPE_API_KEY  # 调用方自备上游密钥",
    ...(gatewayAuthenticated ? [gatewayAuthHeader] : []),
  ];

  const afterHeaders = [
    "Content-Type: application/json",
    ...(gatewayAuthenticated ? [gatewayAuthHeader] : []),
  ];

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div
        className={`rounded-lg border p-3 ${!byokConfigured ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/8" : "border-[var(--color-border)]"}`}
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-medium">未配置 BYOK</span>
          {!byokConfigured && (
            <span className="rounded bg-[var(--color-accent)]/20 px-1.5 py-0.5 text-[10px] text-[var(--color-accent)]">
              当前
            </span>
          )}
        </div>
        <p className="mb-2 text-xs text-[var(--color-muted)]">
          调用方在请求头自带 <code className="mono">Authorization</code>，或由 Admin / Worker 从{" "}
          <code className="mono">.env</code> 注入。
        </p>
        <CodeBlock
          children={
            hasUrl
              ? curlExample(url, model, beforeHeaders)
              : "（请先完成前两步）"
          }
        />
      </div>
      <div
        className={`rounded-lg border p-3 ${byokConfigured ? "border-emerald-700/50 bg-emerald-950/25" : "border-[var(--color-border)]"}`}
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-medium">已配置 BYOK</span>
          {byokConfigured && (
            <span className="rounded bg-emerald-900/50 px-1.5 py-0.5 text-[10px] text-emerald-400">
              当前
            </span>
          )}
        </div>
        <p className="mb-2 text-xs text-[var(--color-muted)]">
          无需上游 <code className="mono">Authorization</code>，Cloudflare 按 provider_slug 自动注入密钥。
        </p>
        <CodeBlock
          children={
            hasUrl
              ? curlExample(
                  url,
                  model,
                  afterHeaders,
                  "无需 Authorization — Cloudflare 用 BYOK 转发上游",
                )
              : "（请先完成前两步）"
          }
        />
      </div>
    </div>
  );
}

export function SetupStepCallGuide({
  step,
  accountId,
  gatewayId,
  providerSlug,
  path,
  model,
  byokConfigured = false,
  gatewayAuthenticated,
}: SetupStepCallGuideProps) {
  const url = buildInvokeUrl(accountId, gatewayId, providerSlug, path);
  const hasUrl = Boolean(url);

  const titles: Record<SetupStep, string> = {
    gateway: "第 1 步 · 网关如何参与调用",
    provider: "第 2 步 · 提供商 slug 如何参与调用",
    byok: "第 3 步 · BYOK 如何改变调用方式",
  };

  const desc: Record<SetupStep, string> = {
    gateway:
      "网关 ID 来自 Cloudflare AI Gateway，出现在 invoke URL 路径中；Admin 默认选中 CF 列表中的网关。",
    provider:
      "custom- 后面的 slug 与 base_url 来自 CF 自定义提供商；API path 为 Responses 固定路径。",
    byok:
      "BYOK 可选：配置后直连 Gateway 时无需再传上游 Authorization；不配置则用 .env DASHSCOPE_API_KEY。",
  };

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div>
        <h3 className="text-sm font-semibold">{titles[step]}</h3>
        <p className="mt-0.5 text-xs text-[var(--color-muted)]">{desc[step]}</p>
      </div>

      <div>
        <p className="text-xs text-[var(--color-muted)]">请求 URL（高亮为本步配置项）</p>
        <UrlLine
          accountId={accountId}
          gatewayId={gatewayId}
          providerSlug={providerSlug}
          highlight={step}
        />
      </div>

      {step === "gateway" && (
        <>
          <CodeBlock
            children={`# 网关由 CF API 管理，Admin 从 GET /config / GET /admin/state 读取

# 若开启网关鉴权（authentication=true），直连时需加：
cf-aig-authorization: Bearer $CF_AIG_TOKEN

# 当前默认网关 id：${gatewayId || "（尚未创建）"}`}
          />
          <p className="text-xs text-[var(--color-muted)]">
            仅有网关还无法完成上游调用，创建后请继续第 2 步添加提供商。
          </p>
        </>
      )}

      {step === "provider" && (
        <>
          <CodeBlock
            children={`# 提供商 slug / base_url 来自 CF 自定义提供商 API
# 当前默认 slug：${providerSlug || "（尚未创建）"}
# Responses API path（固定）：${path || "/compatible-mode/v1/responses"}

# 直连仍需上游密钥（或使用第 3 步 BYOK）：
Authorization: Bearer $DASHSCOPE_API_KEY`}
          />
          {hasUrl && (
            <>
              <p className="text-xs text-[var(--color-muted)]">完整直连示例</p>
              <CodeBlock
                children={curlExample(url, model, [
                  "Content-Type: application/json",
                  "Authorization: Bearer $DASHSCOPE_API_KEY",
                  ...(gatewayAuthenticated
                    ? ["cf-aig-authorization: Bearer $CF_AIG_TOKEN"]
                    : []),
                ])}
              />
            </>
          )}
        </>
      )}

      {step === "byok" && (
        <>
          <ByokComparison
            url={url}
            model={model}
            hasUrl={hasUrl}
            byokConfigured={byokConfigured}
            gatewayAuthenticated={gatewayAuthenticated}
          />
          <CodeBlock
            children={`# Playground（不受 BYOK 影响，仍读 .env）
POST /api/chat
→ Admin 注入 DASHSCOPE_API_KEY → AI Gateway

# 生产客户端：已配 BYOK 后建议直连 Gateway，不再下发上游 Key`}
          />
          {gatewayAuthenticated && (
            <p className="text-xs text-amber-200/90">
              网关已开启鉴权：无论是否 BYOK，直连时都需{" "}
              <code className="mono">cf-aig-authorization</code>。
            </p>
          )}
        </>
      )}
    </div>
  );
}
