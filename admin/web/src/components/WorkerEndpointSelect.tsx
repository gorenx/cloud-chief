import { useT } from "@/contexts/LocaleContext";
import { Select } from "@/components/ui/Select";
import {
  endpointPortLabel,
  WORKER_ENDPOINT_LOCAL,
  WORKER_ENDPOINT_WORKERS_DEV,
  type WorkerEndpointOption,
} from "@admin/worker-endpoints";
import type { WorkerTarget } from "@/lib/playground-session";

function formatEndpointLabel(
  t: ReturnType<typeof useT>,
  ep: WorkerEndpointOption,
): string {
  if (ep.kind === "local") {
    return t("playground.workerEndpointLocal", { port: endpointPortLabel(ep.url) });
  }
  if (ep.kind === "workers_dev") {
    return t("playground.workerEndpointWorkersDev", {
      host: ep.hostname ?? ep.url.replace(/^https?:\/\//, ""),
    });
  }
  return t("playground.workerEndpointCustom", { host: ep.hostname ?? ep.url });
}

export function WorkerEndpointSelect({
  value,
  endpoints,
  onChange,
  className,
}: {
  value: WorkerTarget;
  endpoints: WorkerEndpointOption[];
  onChange: (id: WorkerTarget) => void;
  className?: string;
}) {
  const t = useT();
  const options =
    endpoints.length > 0
      ? endpoints
      : [
          {
            id: WORKER_ENDPOINT_LOCAL,
            kind: "local" as const,
            url: "http://127.0.0.1:8788",
            hostname: null,
          },
        ];
  const selected = options.some((e) => e.id === value) ? value : WORKER_ENDPOINT_LOCAL;

  return (
    <Select
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      {options.map((ep) => (
        <option key={ep.id} value={ep.id}>
          {formatEndpointLabel(t, ep)}
        </option>
      ))}
    </Select>
  );
}

export function workerEndpointSummary(
  t: ReturnType<typeof useT>,
  endpointId: WorkerTarget,
  endpoints: WorkerEndpointOption[] | undefined,
): string {
  const id = endpointId === "online" ? WORKER_ENDPOINT_WORKERS_DEV : endpointId;
  const ep = endpoints?.find((e) => e.id === id);
  if (ep) return formatEndpointLabel(t, ep);
  if (id === WORKER_ENDPOINT_LOCAL) return t("playground.localWorker");
  if (id === WORKER_ENDPOINT_WORKERS_DEV) return t("playground.onlineWorker");
  if (id.startsWith("custom:")) {
    return t("playground.workerEndpointCustom", { host: id.slice("custom:".length) });
  }
  return t("playground.localWorker");
}

export function isLocalWorkerEndpoint(endpointId: WorkerTarget): boolean {
  return endpointId === WORKER_ENDPOINT_LOCAL || endpointId === "local";
}
