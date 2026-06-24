import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CHAT_API_PATH,
  normalizeGatewayPathSuffix,
  RESPONSES_API_PATH,
} from "./gateway-paths";

const adminRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(adminRoot, "gateway-api-paths.json");

export type GatewayApiPathRecord = {
  gateway_id: string;
  provider_slug: string;
  chat_suffix: string;
  responses_suffix: string;
  custom_paths: string[];
};

type Store = { records: GatewayApiPathRecord[] };

function storeKey(gatewayId: string, providerSlug: string): string {
  return `${gatewayId}\0${providerSlug}`;
}

function readStore(): Store {
  try {
    if (!fs.existsSync(configPath)) return { records: [] };
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as Store;
    if (!Array.isArray(parsed.records)) return { records: [] };
    return parsed;
  } catch {
    return { records: [] };
  }
}

function writeStore(store: Store): void {
  fs.writeFileSync(configPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export function normalizeCustomPaths(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const suffix = normalizeGatewayPathSuffix(item);
    if (!suffix || seen.has(suffix)) continue;
    seen.add(suffix);
    out.push(suffix);
  }
  return out;
}

function normalizeBuiltinSuffix(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  return normalizeGatewayPathSuffix(raw) || fallback;
}

function mergeRecord(
  gatewayId: string,
  providerSlug: string,
  raw?: Partial<GatewayApiPathRecord>,
): GatewayApiPathRecord {
  return {
    gateway_id: gatewayId,
    provider_slug: providerSlug,
    chat_suffix: normalizeBuiltinSuffix(raw?.chat_suffix, CHAT_API_PATH),
    responses_suffix: normalizeBuiltinSuffix(raw?.responses_suffix, RESPONSES_API_PATH),
    custom_paths: normalizeCustomPaths(raw?.custom_paths),
  };
}

/** @deprecated use getGatewayApiPathConfig */
export function getGatewayCustomPaths(gatewayId: string, providerSlug: string): string[] {
  return getGatewayApiPathConfig(gatewayId, providerSlug).custom_paths;
}

export function getGatewayApiPathConfig(
  gatewayId: string,
  providerSlug: string,
): GatewayApiPathRecord {
  const store = readStore();
  const rec = store.records.find(
    (r) => r.gateway_id === gatewayId && r.provider_slug === providerSlug,
  );
  return mergeRecord(gatewayId, providerSlug, rec ?? undefined);
}

export function setGatewayApiPathConfig(
  gatewayId: string,
  providerSlug: string,
  input: {
    chat_suffix?: string;
    responses_suffix?: string;
    custom_paths?: string[];
  },
): GatewayApiPathRecord {
  const store = readStore();
  const existing = store.records.find(
    (r) => r.gateway_id === gatewayId && r.provider_slug === providerSlug,
  );
  const next = mergeRecord(gatewayId, providerSlug, {
    chat_suffix: input.chat_suffix ?? existing?.chat_suffix,
    responses_suffix: input.responses_suffix ?? existing?.responses_suffix,
    custom_paths: input.custom_paths ?? existing?.custom_paths,
  });
  const idx = store.records.findIndex(
    (r) => r.gateway_id === gatewayId && r.provider_slug === providerSlug,
  );
  if (idx >= 0) store.records[idx] = next;
  else store.records.push(next);
  writeStore(store);
  return next;
}

/** @deprecated use setGatewayApiPathConfig */
export function setGatewayCustomPaths(
  gatewayId: string,
  providerSlug: string,
  customPaths: string[],
): GatewayApiPathRecord {
  return setGatewayApiPathConfig(gatewayId, providerSlug, { custom_paths: customPaths });
}

export function listGatewayApiPathRecords(): GatewayApiPathRecord[] {
  return readStore().records;
}

/** @internal test helper */
export function _configFilePath(): string {
  return configPath;
}

export function _storeKey(gatewayId: string, providerSlug: string): string {
  return storeKey(gatewayId, providerSlug);
}
