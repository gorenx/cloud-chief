import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
  /** Token 无效时展示原因 */
  invalidMessage?: string;
  /** 始终展开表单（由父级「重新配置 Token」触发） */
  forceOpen?: boolean;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const needsReconfigure = Boolean(invalidMessage);
  const [open, setOpen] = useState(!configured || needsReconfigure || Boolean(forceOpen));
  const [draft, setDraft] = useState("");
  const [revealed, setRevealed] = useState(false);

  const saveMut = useMutation({
    mutationFn: async () => {
      const value = draft.trim();
      if (!value) throw new Error("请填写 API Token");
      const r = await saveWorkerBuilderToken(adminToken, value);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    onSuccess: () => {
      setDraft("");
      setRevealed(false);
      setOpen(false);
      onSaved?.();
      toast.success("已保存 CF_WORKER_BUILDER 到 admin/.env");
      void qc.invalidateQueries({ queryKey: ["worker-builds"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  if (!open && !forceOpen && !needsReconfigure) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-[var(--color-muted)]">
          <code>CF_WORKER_BUILDER</code> 已配置
        </p>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          更换 Token
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel-elevated)]/40 p-4">
      {needsReconfigure && (
        <div className="rounded-lg border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 px-3 py-2 text-sm text-[var(--color-warn)]">
          <p className="font-medium">CF_WORKER_BUILDER 无效，请重新配置</p>
          {invalidMessage && <p className="mt-1 text-xs opacity-90">{invalidMessage}</p>}
        </div>
      )}
      <p className="text-sm text-[var(--color-muted)]">
        {needsReconfigure ? "请重新填写" : "配置"} <code>CF_WORKER_BUILDER</code>：须在{" "}
        <a
          href={CF_TOKEN_DOCS}
          target="_blank"
          rel="noreferrer"
          className="text-[var(--color-accent)] hover:underline"
        >
          My Profile → API Tokens
        </a>{" "}
        创建<strong>用户 Token</strong>（不要用 Account API Tokens）。权限：Account → Workers CI
        Edit、Workers Scripts Read。保存前会自动校验。
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="min-w-[220px] flex-1 font-mono text-xs"
          type={revealed ? "text" : "password"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="粘贴新的 Cloudflare API Token"
          autoComplete="off"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 px-2"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? "隐藏 Token" : "显示 Token"}
        >
          {revealed ? "隐藏" : "显示"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
          {needsReconfigure || forceOpen ? "重新保存" : "保存到 admin/.env"}
        </Button>
        {configured && !needsReconfigure && !forceOpen && (
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            取消
          </Button>
        )}
        <a
          href={CF_TOKEN_DOCS}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center px-2 text-xs text-[var(--color-accent)] hover:underline"
        >
          创建 API Token
        </a>
      </div>
    </div>
  );
}
