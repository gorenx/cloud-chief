import { useCallback, useState } from "react";
import { useT } from "@/contexts/LocaleContext";
import { PlaygroundChatConsole } from "@/components/PlaygroundChatConsole";
import { PlaygroundWorkerHttpConsole } from "@/components/PlaygroundWorkerHttpConsole";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { ChatMessage } from "@/hooks/usePlaygroundChat";
import type { PlaygroundSessionFlags, WorkerTarget } from "@/lib/playground-session";
import {
  persistWorkerConsoleMode,
  readWorkerConsoleMode,
  type WorkerConsoleMode,
} from "@/lib/worker-http-routes";
import type { RefObject } from "react";

export function PlaygroundWorkerMainPanel({
  chatRef,
  messages,
  input,
  onInputChange,
  sending,
  onSendChat,
  flags,
  errorPrefixes,
  workerDir,
  workerTarget,
  workerAccessToken,
  workerTestEmail,
  workerTestPassword,
  effectiveWorkerUrl,
  onModeChange,
  onApiRequestChange,
  onApiHostChange,
}: {
  chatRef: RefObject<HTMLDivElement | null>;
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  sending: boolean;
  onSendChat: () => void;
  flags: PlaygroundSessionFlags;
  errorPrefixes: { requestFailedPrefix: string; errorPrefix: string };
  workerDir: string;
  workerTarget: WorkerTarget;
  workerAccessToken: string;
  workerTestEmail: string;
  workerTestPassword: string;
  effectiveWorkerUrl: string;
  onModeChange?: (mode: WorkerConsoleMode) => void;
  onApiRequestChange?: (method: string, path: string) => void;
  onApiHostChange?: (host: string) => void;
}) {
  const t = useT();
  const supportsChat = flags.supportsChat;
  const [mode, setModeState] = useState<WorkerConsoleMode>(() =>
    supportsChat ? readWorkerConsoleMode() : "api",
  );

  const setMode = useCallback(
    (next: WorkerConsoleMode) => {
      setModeState(next);
      persistWorkerConsoleMode(next);
      onModeChange?.(next);
    },
    [onModeChange],
  );

  const modeOptions = [
    { value: "chat" as const, label: t("playground.workerModeChat") },
    { value: "api" as const, label: t("playground.workerModeApi") },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {supportsChat && (
        <div className="shrink-0 border-b border-[var(--color-border-subtle)] px-4 py-2.5 sm:px-5">
          <SegmentedControl value={mode} onChange={setMode} className="flex w-full max-w-xs" options={modeOptions} />
        </div>
      )}

      {supportsChat && mode === "chat" ? (
        <PlaygroundChatConsole
          chatRef={chatRef}
          messages={messages}
          input={input}
          onInputChange={onInputChange}
          sending={sending}
          onSend={onSendChat}
          hintPath="worker"
          flags={flags}
          errorPrefixes={errorPrefixes}
        />
      ) : (
        <PlaygroundWorkerHttpConsole
          workerDir={workerDir}
          workerTarget={workerTarget}
          workerCapabilities={flags.supportsChat ? { supports_chat: true } : { supports_chat: false }}
          workerAccessToken={workerAccessToken}
          workerTestEmail={workerTestEmail}
          workerTestPassword={workerTestPassword}
          effectiveWorkerUrl={effectiveWorkerUrl}
          onRequestChange={onApiRequestChange}
          onHostChange={onApiHostChange}
        />
      )}
    </div>
  );
}

export type { WorkerConsoleMode };
