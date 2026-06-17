import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { SourceBadge } from "@/components/SourceBadge";
import { WorkerConfigSourceToggle } from "@/components/WorkerConfigSourceToggle";
import type { CallMode, PlaygroundSessionFlags, WorkerConfigSource } from "@/lib/playground-session";
import type { PlaygroundDataView } from "@/lib/playground-sources";
import type { FieldMetaEntry, PublicConfig } from "@/types";
import { cn } from "@/lib/utils";

function gatewayOptions(gateways: string[] | undefined, effectiveGateway: string): string[] {
  const base = gateways ?? [];
  if (!effectiveGateway || base.includes(effectiveGateway)) return base;
  return [effectiveGateway, ...base];
}

export function PlaygroundToolbar({
  callMode,
  onCallModeChange,
  workerConfigSource,
  onWorkerConfigSourceChange,
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
}: {
  callMode: CallMode;
  onCallModeChange: (mode: CallMode) => void;
  workerConfigSource: WorkerConfigSource;
  onWorkerConfigSourceChange: (source: WorkerConfigSource) => void;
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
}) {
  const { controls } = dataView;
  const modelOptions = config?.models ?? [];
  const gatewayOpts = gatewayOptions(config?.gateways, effectiveGateway);

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">聊天调试</h1>

        <div className="flex rounded-lg border border-[var(--color-border)] p-0.5">
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
            直连 Gateway
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
            经 Worker
          </button>
        </div>

        {flags.isWorker && (
          <WorkerConfigSourceToggle
            value={workerConfigSource}
            onChange={onWorkerConfigSourceChange}
          />
        )}

        <div className="flex items-center gap-1.5">
          <Select
            value={effectiveGateway}
            onChange={(e) => onGatewayChange(e.target.value)}
            disabled={flags.gatewayLocked}
            title={flags.gatewayLocked ? "Worker 配置：wrangler CF_GATEWAY_ID" : undefined}
            className="w-auto min-w-[140px] disabled:opacity-60"
          >
            {gatewayOpts.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
          {controls.gateway && <SourceBadge meta={controls.gateway as FieldMetaEntry} />}
        </div>

        <div className="flex items-center gap-1.5">
          <Select
            value={effectiveModel}
            onChange={(e) => onModelChange(e.target.value)}
            disabled={flags.modelLocked}
            title={flags.modelLocked ? "Worker 配置：wrangler DEFAULT_MODEL" : undefined}
            className="w-auto min-w-[160px] disabled:opacity-60"
          >
            {modelOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name || m.id}
              </option>
            ))}
          </Select>
          <SourceBadge meta={controls.model as FieldMetaEntry} />
        </div>

        <Button variant="ghost" size="sm" onClick={onSidebarToggle}>
          {sidebarOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          路由详情
        </Button>
      </div>
      {catalogSynced && catalogSynced.length > 0 && (
        <p className="text-xs text-teal-300/90">
          已自动写入 <code className="mono">admin/.env</code>{" "}
          <code className="mono">MODEL_CATALOG</code>：{catalogSynced.join(", ")}
        </p>
      )}
    </div>
  );
}
