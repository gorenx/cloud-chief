import { ChevronDown, ChevronUp } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import { Button } from "@/components/ui/Button";
import { SelectWithSourceBadge } from "@/components/SourceBadge";
import { WorkerConfigSourceToggle } from "@/components/WorkerConfigSourceToggle";
import { WorkerTargetToggle } from "@/components/WorkerTargetToggle";
import type {
  CallMode,
  PlaygroundSessionFlags,
  WorkerConfigSource,
  WorkerTarget,
} from "@/lib/playground-session";
import type { PlaygroundDataView } from "@/lib/playground-sources";
import type { FieldMetaEntry, PublicConfig } from "@/types";
import { cn } from "@/lib/utils";

function gatewayOptions(
  gateways: string[] | undefined,
  effectiveGateway: string,
): string[] {
  const base = gateways ?? [];
  if (!effectiveGateway || base.includes(effectiveGateway)) return base;
  return [effectiveGateway, ...base];
}

export function PlaygroundToolbar({
  callMode,
  onCallModeChange,
  workerConfigSource,
  onWorkerConfigSourceChange,
  workerTarget,
  onWorkerTargetChange,
  workerOnlineAvailable,
  flags,
  dataView,
  config,
  effectiveGateway,
  onGatewayChange,
  effectiveModel,
  onModelChange,
  sidebarOpen,
  onSidebarToggle,
  catalogSynced,
  onStartLocalDev,
  startingLocalDev,
  hasAdminToken,
  workerHealthResult,
}: {
  callMode: CallMode;
  onCallModeChange: (mode: CallMode) => void;
  workerConfigSource: WorkerConfigSource;
  onWorkerConfigSourceChange: (source: WorkerConfigSource) => void;
  workerTarget: WorkerTarget;
  onWorkerTargetChange: (target: WorkerTarget) => void;
  workerOnlineAvailable: boolean;
  flags: PlaygroundSessionFlags;
  dataView: PlaygroundDataView;
  config: PublicConfig | null;
  effectiveGateway: string;
  onGatewayChange: (gateway: string) => void;
  effectiveModel: string;
  onModelChange: (model: string) => void;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
  catalogSynced?: string[];
  onStartLocalDev?: () => void;
  startingLocalDev?: boolean;
  hasAdminToken?: boolean;
  workerHealthResult?: string | null;
}) {
  const t = useT();
  const { controls } = dataView;
  const modelOptions = config?.models ?? [];
  const gatewayOpts = gatewayOptions(config?.gateways, effectiveGateway);
  const localWorkerHealthy = workerHealthResult?.startsWith("ok");
  const toolbarGrid = cn(
    "grid justify-items-start items-center gap-x-3 gap-y-2",
    "grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]",
    "max-[900px]:grid-cols-1",
  );

  return (
    <div className="mb-4 flex gap-4">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="grid grid-cols-[auto_1fr] items-start gap-x-3">
          <h1 className="pt-1 text-xl font-semibold">
            {t("playground.title")}
          </h1>

          <div className={toolbarGrid}>
            <div className="flex w-fit justify-self-start rounded-lg border border-[var(--color-border)] p-0.5">
              <button
                type="button"
                className={cn(
                  "rounded-md px-3 py-1 text-sm",
                  callMode === "gateway"
                    ? "bg-[var(--color-accent)]/20 text-[var(--color-text)]"
                    : "text-[var(--color-muted)]",
                )}
                onClick={() => onCallModeChange("gateway")}
              >
                {t("playground.directGateway")}
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-md px-3 py-1 text-sm",
                  callMode === "worker"
                    ? "bg-[var(--color-accent)]/20 text-[var(--color-text)]"
                    : "text-[var(--color-muted)]",
                )}
                onClick={() => onCallModeChange("worker")}
              >
                {t("playground.viaWorker")}
              </button>
            </div>

            <SelectWithSourceBadge
              meta={controls.gateway as FieldMetaEntry | undefined}
              value={effectiveGateway}
              onChange={(e) => onGatewayChange(e.target.value)}
              disabled={flags.gatewayLocked}
              title={
                flags.gatewayLocked
                  ? t("playground.gatewayLockedTitle")
                  : undefined
              }
              className="min-w-0 w-full justify-self-stretch disabled:opacity-60"
            >
              {gatewayOpts.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </SelectWithSourceBadge>

            <SelectWithSourceBadge
              meta={controls.model as FieldMetaEntry}
              value={effectiveModel}
              onChange={(e) => onModelChange(e.target.value)}
              disabled={flags.modelLocked}
              title={
                flags.modelLocked ? t("playground.modelLockedTitle") : undefined
              }
              className="min-w-0 w-full justify-self-stretch disabled:opacity-60"
            >
              {modelOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name || m.id}
                </option>
              ))}
            </SelectWithSourceBadge>

            {flags.isWorker && (
              <>
                <WorkerTargetToggle
                  value={workerTarget}
                  onlineAvailable={workerOnlineAvailable}
                  onChange={onWorkerTargetChange}
                />
                <WorkerConfigSourceToggle
                  value={workerConfigSource}
                  onChange={onWorkerConfigSourceChange}
                />
                {workerTarget === "local" && onStartLocalDev ? (
                  <Button
                    size="sm"
                    className="justify-self-start"
                    disabled={
                      !hasAdminToken || startingLocalDev || localWorkerHealthy
                    }
                    onClick={onStartLocalDev}
                  >
                    {startingLocalDev
                      ? t("playground.startingLocal")
                      : localWorkerHealthy
                        ? t("playground.localReady")
                        : t("playground.startLocalWorker")}
                  </Button>
                ) : (
                  <span />
                )}
              </>
            )}
          </div>
        </div>

        {catalogSynced && catalogSynced.length > 0 && (
          <p className="text-xs text-teal-300/90">
            {t("playground.catalogSynced", {
              models: catalogSynced.join(t("common.listSeparator")),
            })}
          </p>
        )}
      </div>

      <div className="w-80 shrink-0">
        <Button variant="ghost" size="sm" onClick={onSidebarToggle}>
          {sidebarOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          {t("playground.routingDetails")}
        </Button>
      </div>
    </div>
  );
}
