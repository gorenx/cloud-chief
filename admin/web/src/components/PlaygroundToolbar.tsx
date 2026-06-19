import { ChevronDown, ChevronUp } from "lucide-react";
import { useT } from "@/contexts/LocaleContext";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
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
    <div className="glass-panel rounded-[var(--radius-xl)] p-4">
      <div className="flex gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className={toolbarGrid}>
            <SegmentedControl
              value={callMode}
              onChange={onCallModeChange}
              options={[
                { value: "gateway" as const, label: t("playground.directGateway") },
                { value: "worker" as const, label: t("playground.viaWorker") },
              ]}
            />

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

          {catalogSynced && catalogSynced.length > 0 && (
            <p className="text-xs text-[var(--color-ice)]/90">
              {t("playground.catalogSynced", {
                models: catalogSynced.join(t("common.listSeparator")),
              })}
            </p>
          )}
        </div>

        <div className="hidden w-80 shrink-0 sm:block">
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
    </div>
  );
}
