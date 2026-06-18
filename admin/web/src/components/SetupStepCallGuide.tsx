import type { SetupStep } from "@/lib/setup-flow";
import { buildInvokeUrl } from "@/lib/api";
import { useT } from "@/contexts/LocaleContext";
import type { MessageKey } from "@/i18n";

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

const GUIDE_TITLE_KEYS: Record<SetupStep, MessageKey> = {
  gateway: "setupFlow.guide.gateway.title",
  provider: "setupFlow.guide.provider.title",
  byok: "setupFlow.guide.byok.title",
};

const GUIDE_DESC_KEYS: Record<SetupStep, MessageKey> = {
  gateway: "setupFlow.guide.gateway.desc",
  provider: "setupFlow.guide.provider.desc",
  byok: "setupFlow.guide.byok.desc",
};

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
  sampleContent: string,
  note?: string,
): string {
  const headerLines = headers.map((h) => `  -H '${h}' \\`).join("\n");
  return `curl -X POST '${url}' \\
${headerLines}
  -d '{"model":"${model}","input":[{"role":"user","content":"${sampleContent}"}],"stream":true}'${note ? `\n\n# ${note}` : ""}`;
}

function UrlLine({
  accountId,
  gatewayId,
  providerSlug,
  highlight,
  accountPh,
  gatewayPh,
  slugPh,
}: {
  accountId: string;
  gatewayId: string;
  providerSlug: string;
  highlight: SetupStep;
  accountPh: string;
  gatewayPh: string;
  slugPh: string;
}) {
  const gw = gatewayId || gatewayPh;
  const slug = providerSlug || slugPh;
  return (
    <p className="mono mt-1 break-all text-xs leading-relaxed">
      <span className="text-[var(--color-muted)]">
        https://gateway.ai.cloudflare.com/v1/{accountId || accountPh}/
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
  const t = useT();
  const gatewayAuthHeader = t("setupFlow.gatewayAuthHeader");

  const beforeHeaders = [
    "Content-Type: application/json",
    "Authorization: Bearer $DASHSCOPE_API_KEY",
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
          <span className="text-sm font-medium">{t("setupFlow.byokNotConfigured")}</span>
          {!byokConfigured && (
            <span className="rounded bg-[var(--color-accent)]/20 px-1.5 py-0.5 text-[10px] text-[var(--color-accent)]">
              {t("setupFlow.byokCurrent")}
            </span>
          )}
        </div>
        <p className="mb-2 text-xs text-[var(--color-muted)]">{t("setupFlow.byokBeforeDesc")}</p>
        <CodeBlock
          children={
            hasUrl
              ? curlExample(url, model, beforeHeaders, t("setupFlow.curlSampleContent"))
              : t("setupFlow.prerequisiteSteps")
          }
        />
      </div>
      <div
        className={`rounded-lg border p-3 ${byokConfigured ? "border-emerald-700/50 bg-emerald-950/25" : "border-[var(--color-border)]"}`}
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-medium">{t("setupFlow.byokConfigured")}</span>
          {byokConfigured && (
            <span className="rounded bg-emerald-900/50 px-1.5 py-0.5 text-[10px] text-emerald-400">
              {t("setupFlow.byokCurrent")}
            </span>
          )}
        </div>
        <p className="mb-2 text-xs text-[var(--color-muted)]">{t("setupFlow.byokAfterDesc")}</p>
        <CodeBlock
          children={
            hasUrl
              ? curlExample(
                  url,
                  model,
                  afterHeaders,
                  t("setupFlow.curlSampleContent"),
                  t("setupFlow.curlNoAuthNote"),
                )
              : t("setupFlow.prerequisiteSteps")
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
  const t = useT();
  const url = buildInvokeUrl(accountId, gatewayId, providerSlug, path);
  const hasUrl = Boolean(url);

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div>
        <h3 className="text-sm font-semibold">{t(GUIDE_TITLE_KEYS[step])}</h3>
        <p className="mt-0.5 text-xs text-[var(--color-muted)]">{t(GUIDE_DESC_KEYS[step])}</p>
      </div>

      <div>
        <p className="text-xs text-[var(--color-muted)]">{t("setupFlow.requestUrlLabel")}</p>
        <UrlLine
          accountId={accountId}
          gatewayId={gatewayId}
          providerSlug={providerSlug}
          highlight={step}
          accountPh={t("setupFlow.urlAccountPh")}
          gatewayPh={t("setupFlow.urlGwPh")}
          slugPh={t("setupFlow.urlSlugPh")}
        />
      </div>

      {step === "gateway" && (
        <>
          <CodeBlock
            children={t("setupFlow.gatewayCodeComment", {
              gatewayId: gatewayId || t("setupFlow.metaGwEmpty"),
            })}
          />
          <p className="text-xs text-[var(--color-muted)]">{t("setupFlow.gatewayOnlyHint")}</p>
        </>
      )}

      {step === "provider" && (
        <>
          <CodeBlock
            children={t("setupFlow.providerCodeComment", {
              slug: providerSlug || t("setupFlow.metaPvEmpty"),
              path: path || "/compatible-mode/v1/responses",
            })}
          />
          {hasUrl && (
            <>
              <p className="text-xs text-[var(--color-muted)]">{t("setupFlow.fullExample")}</p>
              <CodeBlock
                children={curlExample(url, model, [
                  "Content-Type: application/json",
                  "Authorization: Bearer $DASHSCOPE_API_KEY",
                  ...(gatewayAuthenticated
                    ? [t("setupFlow.gatewayAuthHeader")]
                    : []),
                ], t("setupFlow.curlSampleContent"))}
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
          <CodeBlock children={t("setupFlow.playgroundNote")} />
          {gatewayAuthenticated && (
            <p className="text-xs text-amber-200/90">{t("setupFlow.authRequiredNote")}</p>
          )}
        </>
      )}
    </div>
  );
}
