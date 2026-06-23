import { useT } from "@/contexts/LocaleContext";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { FieldLabel, InputWithSourceBadge, SelectWithSourceBadge } from "@/components/SourceBadge";
import { WorkerConfigSourceToggle } from "@/components/WorkerConfigSourceToggle";
import { WorkerEndpointSelect, isLocalWorkerEndpoint } from "@/components/WorkerEndpointSelect";
import { PlaygroundWorkerSelect } from "@/components/PlaygroundWorkerSelect";
import type {
  ChatPath,
  PlaygroundSessionFlags,
  WorkerConfigSource,
  WorkerTarget,
} from "@/lib/playground-session";
import type { WorkerEndpointOption } from "@admin/worker-endpoints";
import { resolveWorkerTierModels } from "@/lib/playground-session";
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

function modelListId(layout: ToolbarLayout) {
  return layout === "sidebar" ? "playground-model-options-sidebar" : "playground-model-options-bar";
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
  workerTierModels?: { free: string; plus: string } | null;
  workerHasGatewayModelVars?: boolean;
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
  workerTierModels,
  catalogSynced,
}: GatewayModelToolbarProps) {
  const t = useT();
  const { controls } = dataView;
  const modelOptions = config?.models ?? [];
  const gatewayOpts = gatewayOptions(config?.gateways, effectiveGateway);
  const sidebar = layout === "sidebar";
  const tierModels = workerTierModels ?? resolveWorkerTierModels(config);

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
    <>
      <InputWithSourceBadge
        meta={controls.model as FieldMetaEntry}
        list={modelListId(layout)}
        value={effectiveModel}
        onChange={(e) => onModelChange(e.target.value)}
        disabled={flags.modelLocked}
        placeholder={t("playground.modelInputPlaceholder")}
        title={flags.modelLocked ? t("playground.modelLockedTitle") : undefined}
        className="min-w-0 w-full"
      />
      <datalist id={modelListId(layout)}>
        {modelOptions.map((m) => (
          <option key={m.id} value={m.id} label={m.display_name || m.id} />
        ))}
      </datalist>
      {flags.workerModelEnforced && tierModels ? (
        <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--color-muted)]">
          {t("playground.modelEnforcedHint")}
        </p>
      ) : null}
    </>
  );

  return (
    <>
      {!flags.hideGatewayModel && (
        sidebar ? (
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
        )
      )}

      {!flags.hideGatewayModel && catalogSynced && catalogSynced.length > 0 && (
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
  workerEndpoints,
  workerTarget,
  onWorkerTargetChange,
  ...gatewayModelProps
}: GatewayModelToolbarProps & {
  chatPath: ChatPath;
  onChatPathChange: (path: ChatPath) => void;
  workerDir: string;
  onWorkerDirChange: (dir: string) => void;
  workers: WorkerListEntry[];
  workersLoading?: boolean;
  hasAdminToken?: boolean;
  workerEndpoints?: WorkerEndpointOption[];
  workerTarget?: WorkerTarget;
  onWorkerTargetChange?: (target: WorkerTarget) => void;
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

      {chatPath === "worker" && workerEndpoints && workerTarget !== undefined && onWorkerTargetChange && (
        <div className="space-y-1.5">
          {sidebar && (
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]/75">
              {t("playground.workerTargetLabel")}
            </span>
          )}
          <WorkerEndpointSelect
            value={workerTarget}
            endpoints={workerEndpoints}
            onChange={onWorkerTargetChange}
            className={sidebar ? "w-full" : undefined}
          />
        </div>
      )}

      {(chatPath !== "worker" || gatewayModelProps.workerHasGatewayModelVars) && (
        <div className={sidebar ? sidebarStack : barGrid}>
          <GatewayModelFields layout={layout} {...gatewayModelProps} />
        </div>
      )}
    </div>
  );
}

export function PlaygroundWorkerToolbar({
  layout = "sidebar",
  workerConfigSource,
  onWorkerConfigSourceChange,
  workerEndpoints,
  workerTarget,
  onWorkerTargetChange,
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
  workerDir: string;
  onWorkerDirChange: (dir: string) => void;
  workers: WorkerListEntry[];
  workersLoading?: boolean;
  hasAdminToken?: boolean;
  onStartLocalDev?: () => void;
  startingLocalDev?: boolean;
  workerHealthResult?: string | null;
  workerEndpoints: WorkerEndpointOption[];
  workerTarget: WorkerTarget;
  onWorkerTargetChange: (target: WorkerTarget) => void;
}) {
  const t = useT();
  const localWorkerHealthy = workerHealthResult?.startsWith("ok");
  const sidebar = layout === "sidebar";
  const localEndpoint = isLocalWorkerEndpoint(workerTarget);

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
          <WorkerEndpointSelect
            value={workerTarget}
            endpoints={workerEndpoints}
            onChange={onWorkerTargetChange}
            className={sidebar ? "w-full" : undefined}
          />
        </div>

        {gatewayModelProps.workerHasGatewayModelVars &&
          !gatewayModelProps.flags.hideGatewayModel && (
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
        )}

        {gatewayModelProps.workerHasGatewayModelVars &&
          !gatewayModelProps.flags.hideGatewayModel && (
          <GatewayModelFields layout={layout} {...gatewayModelProps} />
        )}

        {localEndpoint && onStartLocalDev ? (
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
