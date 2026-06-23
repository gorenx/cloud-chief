export type WorkerEndpointKind = "local" | "workers_dev" | "custom_domain";

export interface WorkerEndpointOption {
  id: string;
  kind: WorkerEndpointKind;
  url: string;
  hostname: string | null;
}

export const WORKER_ENDPOINT_LOCAL = "local";
export const WORKER_ENDPOINT_WORKERS_DEV = "workers_dev";

export function customEndpointId(hostname: string): string {
  return `custom:${hostname.trim().toLowerCase()}`;
}

/** 解析 Playground / API 传入的 worker_target / worker_endpoint */
export function parseWorkerEndpoint(raw: string | null | undefined): string {
  if (!raw || raw === "local") return WORKER_ENDPOINT_LOCAL;
  if (raw === "online") return WORKER_ENDPOINT_WORKERS_DEV;
  if (raw === WORKER_ENDPOINT_WORKERS_DEV) return WORKER_ENDPOINT_WORKERS_DEV;
  if (raw.startsWith("custom:")) return raw;
  return WORKER_ENDPOINT_LOCAL;
}

export function buildWorkerEndpointOptions(
  localUrl: string,
  workersDevUrl: string | null,
  customHostnames: string[],
): WorkerEndpointOption[] {
  const options: WorkerEndpointOption[] = [
    {
      id: WORKER_ENDPOINT_LOCAL,
      kind: "local",
      url: localUrl,
      hostname: null,
    },
  ];

  if (workersDevUrl) {
    let hostname: string | null = null;
    try {
      hostname = new URL(workersDevUrl).hostname;
    } catch {
      /* ignore */
    }
    options.push({
      id: WORKER_ENDPOINT_WORKERS_DEV,
      kind: "workers_dev",
      url: workersDevUrl,
      hostname,
    });
  }

  const seen = new Set<string>();
  for (const raw of customHostnames) {
    const hostname = raw.trim();
    if (!hostname) continue;
    const id = customEndpointId(hostname);
    if (seen.has(id)) continue;
    seen.add(id);
    options.push({
      id,
      kind: "custom_domain",
      url: `https://${hostname}`,
      hostname,
    });
  }

  return options;
}

export function pickEndpointUrl(
  endpoints: WorkerEndpointOption[],
  localUrl: string,
  endpointId: string,
): { url: string; error?: string } {
  const id = parseWorkerEndpoint(endpointId);
  const match = endpoints.find((e) => e.id === id);
  if (match) return { url: match.url };

  if (id === WORKER_ENDPOINT_LOCAL) return { url: localUrl };

  if (id === WORKER_ENDPOINT_WORKERS_DEV) {
    return {
      url: localUrl,
      error: "未解析到线上 Worker（需 CF_API_TOKEN 且已部署并启用 workers.dev）",
    };
  }

  if (id.startsWith("custom:")) {
    return {
      url: localUrl,
      error: `未找到自定义域名 ${id.slice("custom:".length)}（需 CF_API_TOKEN 且已在 Worker 绑定 Custom Domain）`,
    };
  }

  return { url: localUrl, error: `未知 Worker 端点：${id}` };
}

export function endpointPortLabel(url: string): string {
  try {
    const u = new URL(url);
    return u.port || (u.protocol === "https:" ? "443" : "80");
  } catch {
    return "8788";
  }
}
