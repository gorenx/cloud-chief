import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  _configFilePath,
  getGatewayApiPathConfig,
  normalizeCustomPaths,
  setGatewayApiPathConfig,
} from "../src/gateway-api-path-config";
import { CHAT_API_PATH, RESPONSES_API_PATH } from "../src/gateway-paths";

describe("gateway-api-path-config", () => {
  const configPath = _configFilePath();
  let backup: string | null = null;

  beforeEach(() => {
    if (fs.existsSync(configPath)) {
      backup = fs.readFileSync(configPath, "utf8");
    }
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
  });

  afterEach(() => {
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
    if (backup !== null) fs.writeFileSync(configPath, backup, "utf8");
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
