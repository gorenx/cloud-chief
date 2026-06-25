import { env, reconcileDerivedPaths } from "./env";
import { getConfigValue } from "./db/config-store";
import { MIGRATABLE_ENV_KEYS } from "./app-config";

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
