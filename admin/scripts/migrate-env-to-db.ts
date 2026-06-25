/**
 * 将 admin/.env 中的可迁移配置写入 SQLite app_config。
 * 用法: pnpm migrate:env [--force]
 */
import { parseEnvFileContent, envFilePath } from "../src/env";
import { initDatabase, closeDatabase } from "../src/db/connection";
import { getConfigValue, setConfigValue } from "../src/db/config-store";
import { MIGRATABLE_ENV_KEYS } from "../src/app-config";
import { overlayAppConfigFromDb } from "../src/app-config-overlay";
import fs from "node:fs";

const force = process.argv.includes("--force");

function main(): void {
  if (!fs.existsSync(envFilePath)) {
    console.error(`❌ 未找到 ${envFilePath}`);
    process.exit(1);
  }

  const fromFile = parseEnvFileContent(fs.readFileSync(envFilePath, "utf8"));
  initDatabase();

  const migrated: string[] = [];
  const skipped: string[] = [];
  const empty: string[] = [];

  for (const key of MIGRATABLE_ENV_KEYS) {
    const fileVal = fromFile[key]?.trim() ?? "";
    if (!fileVal) {
      empty.push(key);
      continue;
    }
    const existing = getConfigValue(key);
    if (existing !== null && !force) {
      skipped.push(key);
      continue;
    }
    setConfigValue(key, fileVal);
    migrated.push(key);
  }

  overlayAppConfigFromDb();
  closeDatabase();

  console.log("✅ env → SQLite 迁移完成");
  if (migrated.length) console.log(`   写入: ${migrated.join(", ")}`);
  if (skipped.length) console.log(`   跳过（已在 DB，用 --force 覆盖）: ${skipped.join(", ")}`);
  if (empty.length) console.log(`   留空（.env 无值）: ${empty.length} 项`);
  if (!migrated.length && !skipped.length) {
    console.log("   无可迁移项（检查 .env 是否已配置）");
  }
}

main();
