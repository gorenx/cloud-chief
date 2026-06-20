import { useT } from "@/contexts/LocaleContext";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { FieldLabel, SelectWithSourceBadge } from "@/components/SourceBadge";
import { WorkerConfigSourceToggle } from "@/components/WorkerConfigSourceToggle";
import { WorkerTargetToggle } from "@/components/WorkerTargetToggle";
import { PlaygroundWorkerSelect } from "@/components/PlaygroundWorkerSelect";
import type {
  ChatPath,
  PlaygroundSessionFlags,
  WorkerConfigSource,
  WorkerTarget,
} from "@/lib/playground-session";
import type { PlaygroundDataView } from "@/lib/playground-sources";
import type { FieldMetaEntry, PublicConfig, WorkerListEntry } from "@/types";
import { cn } from "@/lib/utils";

function gatewayOptions(
  gateways: string[] | undefined,
  effectiveGateway: string,
): string[] {
  const base = gateways ?? [];
  if (!effectiveGateway || base.includes(effectiveGateway)) return base;
  return [effectiveGateway, ...base];
}

type ToolbarLayout = "sidebar" | "bar";

type GatewayModelToolbarProps = {
  layout?: ToolbarLayout;
  flags: PlaygroundSessionFlags;
  dataView: PlaygroundDataView;
  config: PublicConfig | null;
  effectiveGateway: string;
  onGatewayChange: (gateway: string) => void;
  effectiveModel: string;
  onModelChange: (model: string) => void;
  catalogSynced?: string[];
};

function GatewayModelFields({
  layout = "sidebar",
  flags,
  dataView,
  config,
  effectiveGateway,
  onGatewayChange,
  effectiveModel,
  onModelChange,
  catalogSynced,
}: GatewayModelToolbarProps) {
  const t = useT();
  const { controls } = dataView;
  const modelOptions = config?.models ?? [];
  const gatewayOpts = gatewayOptions(config?.gateways, effectiveGateway);
  const sidebar = layout === "sidebar";

  const gatewaySelect = (
    <SelectWithSourceBadge
      meta={controls.gateway as FieldMetaEntry | undefined}
      value={effectiveGateway}
      onChange={(e) => onGatewayChange(e.target.value)}
      disabled={flags.gatewayLocked}
      title={flags.gatewayLocked ? t("playground.gatewayLockedTitle") : undefined}
      className="min-w-0 w-full disabled:opacity-60"
    >
      {gatewayOpts.map((g) => (
        <option key={g} value={g}>
          {g}
        </option>
      ))}
    </SelectWithSourceBadge>
  );

  const modelSelect = (
    <SelectWithSourceBadge
      meta={controls.model as FieldMetaEntry}
      value={effectiveModel}
      onChange={(e) => onModelChange(e.target.value)}
      disabled={flags.modelLocked}
      title={flags.modelLocked ? t("playground.modelLockedTitle") : undefined}
      className="min-w-0 w-full disabled:opacity-60"
    >
      {modelOptions.map((m) => (
        <option key={m.id} value={m.id}>
          {m.display_name || m.id}
        </option>
      ))}
    </SelectWithSourceBadge>
  );

  return (
    <>
      {sidebar ? (
        <>
          <label className="flex min-w-0 flex-col gap-1.5">
            <FieldLabel label={t("playground.sourceGateway")} meta={controls.gateway as FieldMetaEntry} />
            {gatewaySelect}
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <FieldLabel label={t("playground.sourceModel")} meta={controls.model as FieldMetaEntry} />
            {modelSelect}
          </label>
        </>
      ) : (
        <>
          {gatewaySelect}
          {modelSelect}
        </>
      )}

      {catalogSynced && catalogSynced.length > 0 && (
        <p className={cn("text-xs text-[var(--color-ice)]/90", !sidebar && "col-span-full")}>
          {t("playground.catalogSynced", {
            models: catalogSynced.join(t("common.listSeparator")),
          })}
        </p>
      )}
    </>
  );
}

const barGrid = cn(
  "grid justify-items-start items-center gap-x-3 gap-y-2",
  "grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
  "max-[900px]:grid-cols-1",
);

const sidebarStack = "flex min-w-0 flex-col gap-3";

export function PlaygroundGatewayToolbar({
  layout = "sidebar",
  ...props
}: GatewayModelToolbarProps) {
  return (
    <div className={layout === "sidebar" ? sidebarStack : barGrid}>
      <GatewayModelFields layout={layout} {...props} />
    </div>
  );
}

export function PlaygroundChatToolbar({
  layout = "sidebar",
  chatPath,
  onChatPathChange,
  workerDir,
  onWorkerDirChange,
  workers,
  workersLoading,
  hasAdminToken,
  ...gatewayModelProps
}: GatewayModelToolbarProps & {
  chatPath: ChatPath;
  onChatPathChange: (path: ChatPath) => void;
  workerDir: string;
  onWorkerDirChange: (dir: string) => void;
  workers: WorkerListEntry[];
  workersLoading?: boolean;
  hasAdminToken?: boolean;
}) {
  const t = useT();
  const sidebar = layout === "sidebar";

  return (
    <div className={sidebarStack}>
      <div className="space-y-1.5">
        {sidebar && (
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]/75">
            {t("playground.chatPathLabel")}
          </span>
        )}
        <SegmentedControl
          value={chatPath}
          onChange={onChatPathChange}
          className={sidebar ? "flex w-full" : undefined}
          options={[
            { value: "gateway", label: t("playground.directGateway") },
            { value: "worker", label: t("playground.viaWorker") },
          ]}
        />
      </div>

      {chatPath === "worker" && (
        <PlaygroundWorkerSelect
          workers={workers}
          value={workerDir}
          onChange={onWorkerDirChange}
          loading={workersLoading}
          disabled={!hasAdminToken}
        />
      )}

      <div className={sidebar ? sidebarStack : barGrid}>
        <GatewayModelFields layout={layout} {...gatewayModelProps} />
      </div>
    </div>
  );
}

export function PlaygroundWorkerToolbar({
  layout = "sidebar",
  workerConfigSource,
  onWorkerConfigSourceChange,
  workerTarget,
  onWorkerTargetChange,
  workerOnlineAvailable,
  workerDir,
  onWorkerDirChange,
  workers,
  workersLoading,
  hasAdminToken,
  onStartLocalDev,
  startingLocalDev,
  workerHealthResult,
  ...gatewayModelProps
}: GatewayModelToolbarProps & {
  workerConfigSource: WorkerConfigSource;
  onWorkerConfigSourceChange: (source: WorkerConfigSource) => void;
  workerTarget: WorkerTarget;
  onWorkerTargetChange: (target: WorkerTarget) => void;
  workerOnlineAvailable: boolean;
  workerDir: string;
  onWorkerDirChange: (dir: string) => void;
  workers: WorkerListEntry[];
  workersLoading?: boolean;
  hasAdminToken?: boolean;
  onStartLocalDev?: () => void;
  startingLocalDev?: boolean;
  workerHealthResult?: string | null;
}) {
  const t = useT();
  const localWorkerHealthy = workerHealthResult?.startsWith("ok");
  const sidebar = layout === "sidebar";

  return (
    <div className={sidebarStack}>
      <PlaygroundWorkerSelect
        workers={workers}
        value={workerDir}
        onChange={onWorkerDirChange}
        loading={workersLoading}
        disabled={!hasAdminToken}
      />

      <div className={sidebar ? sidebarStack : barGrid}>
        <div className={sidebar ? "space-y-1.5" : undefined}>
          {sidebar && (
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]/75">
              {t("playground.workerTargetLabel")}
            </span>
          )}
          <WorkerTargetToggle
            value={workerTarget}
            onlineAvailable={workerOnlineAvailable}
            onChange={onWorkerTargetChange}
          />
        </div>

        <div className={sidebar ? "space-y-1.5" : undefined}>
          {sidebar && (
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]/75">
              {t("playground.workerConfigSourceLabel")}
            </span>
          )}
          <WorkerConfigSourceToggle
            value={workerConfigSource}
            onChange={onWorkerConfigSourceChange}
            className={sidebar ? "w-full" : undefined}
          />
        </div>

        <GatewayModelFields layout={layout} {...gatewayModelProps} />

        {workerTarget === "local" && onStartLocalDev ? (
          <Button
            size="sm"
            className={sidebar ? "w-full justify-center" : "justify-self-start sm:col-span-2"}
            disabled={!hasAdminToken || startingLocalDev || localWorkerHealthy}
            onClick={onStartLocalDev}
          >
            {startingLocalDev
              ? t("playground.startingLocal")
              : localWorkerHealthy
                ? t("playground.localReady")
                : t("playground.startLocalWorker")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** @deprecated Use tab-specific toolbars instead */
export const PlaygroundToolbar = PlaygroundWorkerToolbar;
