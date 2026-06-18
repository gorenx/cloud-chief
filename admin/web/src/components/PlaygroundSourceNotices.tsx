import { useT } from "@/contexts/LocaleContext";
import { SourceBadge } from "./SourceBadge";
import type { FieldMetaEntry } from "@/types";

/** 坑 2：聊天代理固定 .env，BYOK 只对 invoke_url 直连有效 */
export function ChatAuthPathNotice({
  chatAuthMeta,
  hasByok,
}: {
  chatAuthMeta?: FieldMetaEntry;
  hasByok: boolean;
}) {
  const t = useT();

  return (
    <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div>
        <div className="flex flex-wrap items-center gap-1.5 text-[var(--color-text)]">
          <span className="font-medium">{t("playground.chatPageTitle")}</span>
          {chatAuthMeta && <SourceBadge meta={chatAuthMeta} />}
        </div>
        <p className="mt-1 text-[var(--color-muted)]">{t("playground.chatPageDesc")}</p>
      </div>
      <div className="border-t border-[var(--color-border)] pt-2">
        <p className="font-medium text-[var(--color-text)]">{t("playground.invokeDirectTitle")}</p>
        <p className="mt-1 text-[var(--color-muted)]">
          {t("playground.invokeDirectDesc")}
          {hasByok ? t("playground.invokeDirectDescWithByok") : t("playground.invokeDirectDescNoByok")}{" "}
          {t("playground.invokeDirectEnv")}
        </p>
        {hasByok && (
          <p className="mt-1.5 text-amber-200">{t("playground.byokSidebarWarn")}</p>
        )}
      </div>
    </div>
  );
}
