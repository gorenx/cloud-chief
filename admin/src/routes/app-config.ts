import { Hono } from "hono";
import { z } from "zod";
import { env } from "../env";
import {
  APP_CONFIG_FIELDS,
  APP_CONFIG_SECTION_ORDER,
  BOOTSTRAP_ENV_KEYS,
  isMigratableEnvKey,
  maskConfigValue,
  type AppConfigSectionId,
} from "../app-config";
import { overlayAppConfigFromDb } from "../app-config-overlay";
import { getConfigValue, setConfigValue, deleteConfigValue } from "../db/config-store";

export const appConfigRoutes = new Hono();

function effectiveValue(key: string): string {
  const db = getConfigValue(key);
  if (db !== null) return db;
  const v = (env as Record<string, unknown>)[key];
  return typeof v === "string" ? v : String(v ?? "");
}

function inDb(key: string): boolean {
  return getConfigValue(key) !== null;
}

function envOnlyValue(key: string): string {
  const db = getConfigValue(key);
  if (db !== null) return "";
  const v = (env as Record<string, unknown>)[key];
  return typeof v === "string" ? v : String(v ?? "");
}

appConfigRoutes.get("/field/:key", (c) => {
  const key = c.req.param("key");
  if (!key || !isMigratableEnvKey(key)) {
    return c.json({ error: "无效或未支持的配置项" }, 400);
  }
  const db = getConfigValue(key);
  const source = db !== null ? "db" : "env";
  const value = db !== null ? db : envOnlyValue(key);
  return c.json({
    key,
    value,
    source,
    in_db: db !== null,
  });
});

appConfigRoutes.get("/", (c) => {
  const sections = APP_CONFIG_SECTION_ORDER.map((sectionId) => ({
    id: sectionId,
    fields: APP_CONFIG_FIELDS
      .filter((f) => f.section === sectionId)
      .map((f) => {
        const value = effectiveValue(f.key);
        const stored = inDb(f.key);
        const dbRaw = stored ? getConfigValue(f.key) ?? "" : "";
        return {
          key: f.key,
          value: f.sensitive && value ? maskConfigValue(value) : value,
          db_value: stored && f.sensitive && dbRaw ? maskConfigValue(dbRaw) : dbRaw,
          has_value: Boolean(value),
          in_db: stored,
          sensitive: Boolean(f.sensitive),
          hint: f.hint ?? "",
        };
      }),
  }));

  return c.json({
    sections,
    bootstrap_keys: [...BOOTSTRAP_ENV_KEYS],
    bootstrap: Object.fromEntries(
      BOOTSTRAP_ENV_KEYS.map((k) => [k, (env as Record<string, unknown>)[k] ?? process.env[k] ?? ""]),
    ),
  });
});

const patchBody = z.object({
  values: z.record(z.string(), z.string()),
});

appConfigRoutes.put("/", async (c) => {
  const parsed = patchBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: "请求体须为 { values: Record<string,string> }" }, 400);
  }

  const updated: string[] = [];
  const removed: string[] = [];

  for (const [key, value] of Object.entries(parsed.data.values)) {
    if (!isMigratableEnvKey(key)) {
      return c.json({ error: `不可写入 SQLite 的配置项: ${key}` }, 400);
    }
    if (value.trim() === "") {
      if (getConfigValue(key) !== null) {
        deleteConfigValue(key);
        removed.push(key);
      }
      continue;
    }
    setConfigValue(key, value);
    updated.push(key);
  }

  overlayAppConfigFromDb();

  return c.json({
    ok: true,
    updated,
    removed,
    effective: Object.fromEntries(
      [...updated, ...removed].map((k) => [k, effectiveValue(k)]),
    ),
  });
});

export type AppConfigSectionResponse = {
  id: AppConfigSectionId;
  fields: Array<{
    key: string;
    value: string;
    has_value: boolean;
    in_db: boolean;
    sensitive: boolean;
    hint: string;
  }>;
};
