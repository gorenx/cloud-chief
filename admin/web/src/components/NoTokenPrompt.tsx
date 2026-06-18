import { Link } from "react-router-dom";
import { useT } from "@/contexts/LocaleContext";
import type { MessageKey } from "@/i18n";

export function NoTokenPrompt({
  className,
  suffixKey = "common.noTokenSuffix",
}: {
  className?: string;
  suffixKey?: MessageKey;
}) {
  const t = useT();
  return (
    <p className={className ?? "text-sm text-[var(--color-muted)]"}>
      {t("common.noTokenPrefix")}{" "}
      <Link to="/settings" className="text-[var(--color-accent)]">
        {t("common.settingsLink")}
      </Link>{" "}
      {t(suffixKey)}
    </p>
  );
}
