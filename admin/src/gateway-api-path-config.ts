import {
  CHAT_API_PATH,
  normalizeGatewayPathSuffix,
  RESPONSES_API_PATH,
} from "./gateway-paths";
import { decryptValue, encryptValue } from "./db/crypto";
import { getDb, legacyConfigFilePath } from "./db/connection";

export type GatewayApiPathRecord = {
  gateway_id: string;
  provider_slug: string;
  chat_suffix: string;
  responses_suffix: string;
  custom_paths: string[];
};

function storeKey(gatewayId: string, providerSlug: string): string {
  return `${gatewayId}\0${providerSlug}`;
}

function readEncryptedField(stored: string): string {
  try {
    return decryptValue(stored);
  } catch {
    return stored;
  }
}

function readCustomPaths(stored: string): string[] {
  const raw = readEncryptedField(stored);
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeCustomPaths(parsed);
  } catch {
    return [];
  }
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
  const row = getDb()
    .prepare(
      `SELECT chat_suffix, responses_suffix, custom_paths
       FROM gateway_api_paths
       WHERE gateway_id = ? AND provider_slug = ?`,
    )
    .get(gatewayId, providerSlug) as
    | { chat_suffix: string; responses_suffix: string; custom_paths: string }
    | undefined;

  if (!row) return mergeRecord(gatewayId, providerSlug);

  return mergeRecord(gatewayId, providerSlug, {
    chat_suffix: readEncryptedField(row.chat_suffix),
    responses_suffix: readEncryptedField(row.responses_suffix),
    custom_paths: readCustomPaths(row.custom_paths),
  });
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
  const existing = getGatewayApiPathConfig(gatewayId, providerSlug);
  const next = mergeRecord(gatewayId, providerSlug, {
    chat_suffix: input.chat_suffix ?? existing.chat_suffix,
    responses_suffix: input.responses_suffix ?? existing.responses_suffix,
    custom_paths: input.custom_paths ?? existing.custom_paths,
  });

  getDb()
    .prepare(
      `INSERT INTO gateway_api_paths
         (gateway_id, provider_slug, chat_suffix, responses_suffix, custom_paths)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(gateway_id, provider_slug) DO UPDATE SET
         chat_suffix = excluded.chat_suffix,
         responses_suffix = excluded.responses_suffix,
         custom_paths = excluded.custom_paths`,
    )
    .run(
      gatewayId,
      providerSlug,
      encryptValue(next.chat_suffix),
      encryptValue(next.responses_suffix),
      encryptValue(JSON.stringify(next.custom_paths)),
    );

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
  const rows = getDb()
    .prepare(
      `SELECT gateway_id, provider_slug, chat_suffix, responses_suffix, custom_paths
       FROM gateway_api_paths`,
    )
    .all() as Array<{
    gateway_id: string;
    provider_slug: string;
    chat_suffix: string;
    responses_suffix: string;
    custom_paths: string;
  }>;

  return rows.map((row) =>
    mergeRecord(row.gateway_id, row.provider_slug, {
      chat_suffix: readEncryptedField(row.chat_suffix),
      responses_suffix: readEncryptedField(row.responses_suffix),
      custom_paths: readCustomPaths(row.custom_paths),
    }),
  );
}

/** @internal test helper */
export function _configFilePath(): string {
  return legacyConfigFilePath();
}

export function _storeKey(gatewayId: string, providerSlug: string): string {
  return storeKey(gatewayId, providerSlug);
}
