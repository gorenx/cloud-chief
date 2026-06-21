import type { RefObject, ReactNode } from "react";
import { useT } from "@/contexts/LocaleContext";
import type { ChatPath, PlaygroundSessionFlags } from "@/lib/playground-session";
import { emptyChatHint } from "@/i18n/playground-ui";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/hooks/usePlaygroundChat";

export function PlaygroundChatConsole({
  chatRef,
  messages,
  input,
  onInputChange,
  sending,
  onSend,
  hintPath,
  flags,
  errorPrefixes,
  headerExtra,
}: {
  chatRef: RefObject<HTMLDivElement | null>;
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  sending: boolean;
  onSend: () => void;
  hintPath: ChatPath;
  flags: PlaygroundSessionFlags;
  errorPrefixes: { requestFailedPrefix: string; errorPrefix: string };
  headerExtra?: ReactNode;
}) {
  const t = useT();

  return (
    <>
      <div className="shrink-0 border-b border-[var(--color-border-subtle)] px-4 py-2 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-muted)]/75">
            {t("playground.consoleLabel")}
          </span>
          {headerExtra}
        </div>
      </div>

      <div ref={chatRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-muted)]">
            {emptyChatHint(t, hintPath, flags)}
          </p>
        ) : (
          <div className="mx-auto max-w-2xl space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-[var(--radius-lg)] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-[var(--color-accent-glow)] text-[var(--color-text)] ring-1 ring-[var(--color-accent)]/20"
                      : "bg-[var(--color-bg-elevated)] text-[var(--color-text)] ring-1 ring-[var(--color-border-subtle)]",
                    msg.content.startsWith(errorPrefixes.requestFailedPrefix) ||
                      msg.content.startsWith(errorPrefixes.errorPrefix)
                      ? "text-[var(--color-err)] ring-[var(--color-err)]/30"
                      : "",
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--color-border-subtle)] bg-[var(--color-panel-elevated)]/20 px-4 py-3 sm:px-5">
        <div className="mx-auto flex max-w-2xl gap-2">
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={1}
            placeholder={t("playground.sendPlaceholder")}
            className="flex-1 resize-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-glow)]"
          />
          <Button disabled={sending || !input.trim()} onClick={onSend}>
            {t("playground.send")}
          </Button>
        </div>
      </div>
    </>
  );
}
