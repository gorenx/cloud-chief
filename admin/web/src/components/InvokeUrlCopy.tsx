import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { useT } from "@/contexts/LocaleContext";
import { Button } from "./ui/Button";

export function InvokeUrlCopy({ url }: { url: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  if (!url) {
    return <span className="text-xs text-[var(--color-muted)]">{t("invoke.missingConfig")}</span>;
  }

  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]/80 p-3 ring-1 ring-[var(--color-border-subtle)]">
      <code className="mono flex-1 break-all text-xs leading-relaxed text-[var(--color-ice)]/90">
        {url}
      </code>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-[var(--color-ok)]" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
