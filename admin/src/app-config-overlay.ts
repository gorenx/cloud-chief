import { env, reconcileDerivedPaths } from "./env";
import { getConfigValue, setConfigValue } from "./db/config-store";
import { MIGRATABLE_ENV_KEYS } from "./app-config";

/** 首次启动时用 .env 填充 SQLite；之后 DB 缺值才会再次使用 .env。 */
export function seedAppConfigFromEnv(): void {
  for (const key of MIGRATABLE_ENV_KEYS) {
    if (getConfigValue(key) !== null) continue;
    const raw = (env as Record<string, unknown>)[key];
    const value = typeof raw === "string" ? raw : String(raw ?? "");
    if (!value.trim()) continue;
    setConfigValue(key, value);
  }
}

/** SQLite app_config 覆盖 env（DB 优先于 .env） */
export function overlayAppConfigFromDb(): void {
  for (const key of MIGRATABLE_ENV_KEYS) {
    const dbVal = getConfigValue(key);
    if (dbVal === null) continue;
    (env as Record<string, unknown>)[key] = dbVal;
    process.env[key] = dbVal;
  }
  reconcileDerivedPaths();
}
