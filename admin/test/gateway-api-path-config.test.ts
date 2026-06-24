import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, initDatabase } from "../src/db/connection";
import {
  getGatewayApiPathConfig,
  normalizeCustomPaths,
  setGatewayApiPathConfig,
} from "../src/gateway-api-path-config";
import { CHAT_API_PATH, RESPONSES_API_PATH } from "../src/gateway-paths";

describe("gateway-api-path-config", () => {
  let dbPath = "";

  beforeEach(() => {
    closeDatabase();
    dbPath = path.join(os.tmpdir(), `admin-gw-paths-${Date.now()}-${Math.random()}.db`);
    process.env.ADMIN_DB_PATH = dbPath;
    process.env.ADMIN_DB_ENCRYPT = "0";
    initDatabase();
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    delete process.env.ADMIN_DB_PATH;
  });

  it("normalizeCustomPaths dedupes and normalizes", () => {
    expect(normalizeCustomPaths(["/embeddings", "embeddings", "  "])).toEqual(["/embeddings"]);
  });

  it("defaults chat/responses suffixes when unset", () => {
    const cfg = getGatewayApiPathConfig("gw-a", "prov-x");
    expect(cfg.chat_suffix).toBe(CHAT_API_PATH);
    expect(cfg.responses_suffix).toBe(RESPONSES_API_PATH);
    expect(cfg.custom_paths).toEqual([]);
  });

  it("get/set round-trips per gateway + provider", () => {
    setGatewayApiPathConfig("gw-a", "prov-x", {
      chat_suffix: "/compatible-mode/v1/chat/completions",
      responses_suffix: "/compatible-mode/v1/responses",
      custom_paths: ["/embeddings"],
    });
    expect(getGatewayApiPathConfig("gw-a", "prov-x")).toEqual({
      gateway_id: "gw-a",
      provider_slug: "prov-x",
      chat_suffix: "/compatible-mode/v1/chat/completions",
      responses_suffix: "/compatible-mode/v1/responses",
      custom_paths: ["/embeddings"],
    });
    expect(getGatewayApiPathConfig("gw-b", "prov-x").custom_paths).toEqual([]);
  });
});
