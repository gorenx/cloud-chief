import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLocale } from "@/contexts/LocaleContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { saveWorkerBuilderToken } from "@/lib/api";

const CF_TOKEN_DOCS = "https://dash.cloudflare.com/profile/api-tokens";

export function WorkerBuilderTokenPanel({
  adminToken,
  configured,
  invalidMessage,
  forceOpen,
  onSaved,
}: {
  adminToken: string;
  configured: boolean;
  invalidMessage?: string;
  forceOpen?: boolean;
  onSaved?: () => void;
}) {
  const { t, displayError } = useLocale();
  const qc = useQueryClient();
  const needsReconfigure = Boolean(invalidMessage);
  const [open, setOpen] = useState(!configured || needsReconfigure || Boolean(forceOpen));
  const [draft, setDraft] = useState("");
  const [revealed, setRevealed] = useState(false);

  const saveMut = useMutation({
    mutationFn: async () => {
      const value = draft.trim();
      if (!value) throw new Error(t("worker.builder.fillToken"));
      const r = await saveWorkerBuilderToken(adminToken, value);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: () => {
      setDraft("");
      setRevealed(false);
      setOpen(false);
      onSaved?.();
      toast.success(t("worker.toast.builderSaved"));
      void qc.invalidateQueries({ queryKey: ["worker-builds"] });
    },
    onError: (e) => toast.error(displayError(e instanceof Error ? e.message : String(e))),
  });

  if (!open && !forceOpen && !needsReconfigure) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-[var(--color-muted)]">{t("worker.builder.configured")}</p>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          {t("btn.worker.replaceToken")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-elevated)]/40 p-4">
      {needsReconfigure && (
        <div className="rounded-lg border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 px-3 py-2 text-sm text-[var(--color-warn)]">
          <p className="font-medium">{t("worker.builder.invalidTitle")}</p>
          {invalidMessage && <p className="mt-1 text-xs opacity-90">{invalidMessage}</p>}
        </div>
      )}
      <p className="text-sm text-[var(--color-muted)]">
        {needsReconfigure ? t("worker.builder.reconfigure") : t("worker.builder.configure")}{" "}
        <code>CF_WORKER_BUILDER</code>:{" "}
        <a
          href={CF_TOKEN_DOCS}
          target="_blank"
          rel="noreferrer"
          className="text-[var(--color-accent)] hover:underline"
        >
          My Profile → API Tokens
        </a>{" "}
        {t("worker.builder.promptIntro")} {t("worker.builder.promptPermissions")}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="min-w-[220px] flex-1 font-mono text-xs"
          type={revealed ? "text" : "password"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("worker.builder.tokenPlaceholder")}
          autoComplete="off"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 px-2"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? t("aria.hideToken") : t("aria.showToken")}
        >
          {revealed ? t("btn.common.hide") : t("btn.common.show")}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
          {needsReconfigure || forceOpen
            ? t("btn.worker.resaveBuilder")
            : t("btn.worker.saveBuilderEnv")}
        </Button>
        {configured && !needsReconfigure && !forceOpen && (
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            {t("btn.common.cancel")}
          </Button>
        )}
        <a
          href={CF_TOKEN_DOCS}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center px-2 text-xs text-[var(--color-accent)] hover:underline"
        >
          {t("btn.worker.createApiToken")}
        </a>
      </div>
    </div>
  );
}
