import fs from "node:fs";
import path from "node:path";
import { env, workerDir } from "./env";
import { gatewayUrl } from "./cf";
import { lookupModel } from "./model-catalog";

export interface ProviderInfo {
  id?: string;
  slug: string;
  base_url: string;
  enable?: boolean;
}

export interface RoutingInfo {
  model: string;
  worker_model: string | null;
  provider_slug: string;
  provider: ProviderInfo | null;
  path: string;
  invoke_url: string;
  api_type: "responses";
  base_url: string;
}

function readWorkerModel(): string | null {
  const file = path.join(workerDir, "wrangler.toml");
  try {
    const toml = fs.readFileSync(file, "utf8");
    let inVars = false;
    for (const line of toml.split("\n")) {
      const t = line.trim();
      if (t.startsWith("[")) {
        inVars = t === "[vars]";
        continue;
      }
      if (!inVars || !t || t.startsWith("#")) continue;
      const m = t.match(/^DEFAULT_MODEL\s*=\s*(.+)$/);
      if (!m) continue;
      let v = m[1].trim();
      if (v.startsWith('"')) {
        const end = v.indexOf('"', 1);
        v = end > 0 ? v.slice(1, end) : v.slice(1);
      }
      return v || null;
    }
  } catch {
    /* worker 目录不存在时忽略 */
  }
  return null;
}

export function buildRouting(
  gatewayId: string,
  providers: ProviderInfo[],
  modelOverride?: string,
): RoutingInfo {
  const model = modelOverride ?? env.MODEL;
  const providerSlug = env.PROVIDER_SLUG;
  const provider = providers.find((p) => p.slug === providerSlug) ?? null;
  const pathStr = env.PROVIDER_PATH;
  const invokeUrl =
    providerSlug && gatewayId
      ? gatewayUrl(gatewayId, providerSlug, pathStr)
      : "";

  return {
    model,
    worker_model: readWorkerModel(),
    provider_slug: providerSlug,
    provider,
    path: pathStr,
    invoke_url: invokeUrl,
    api_type: "responses",
    base_url: env.PROVIDER_BASE_URL,
  };
}

export function modelMetaFor(modelId: string) {
  return lookupModel(modelId);
}
