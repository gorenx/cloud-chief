import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/Button";

export function InvokeUrlCopy({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  if (!url) {
    return <span className="text-xs text-[var(--color-muted)]">（缺少网关或提供商配置）</span>;
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <code className="mono flex-1 break-all text-xs leading-relaxed text-[var(--color-text)]">{url}</code>
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
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
