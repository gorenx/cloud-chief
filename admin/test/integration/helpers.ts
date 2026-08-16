import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { envFilePath, parseEnvFileContent } from "../../src/env";
import { createGatewayOpenAiClient, gatewayCompatibleBaseUrl } from "../../src/openai-llm";

const ADMIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const WORKER_ROOT = resolve(ADMIN_ROOT, "../ai-gateway-worker");

export type UpstreamKind = "chat" | "responses";

function parseDotEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    out[key] = line.slice(eq + 1).trim();
  }
  return out;
}

function loadAdminEnv(): Record<string, string> {
  if (!existsSync(envFilePath)) return {};
  return parseEnvFileContent(readFileSync(envFilePath, "utf8"));
}

function loadWorkerDevVars(): Record<string, string> {
  const path = resolve(WORKER_ROOT, ".dev.vars");
  if (!existsSync(path)) return {};
  return parseDotEnv(readFileSync(path, "utf8"));
}

function loadWranglerVars(): Record<string, string> {
  const path = resolve(WORKER_ROOT, "wrangler.toml");
  if (!existsSync(path)) return {};
  const text = readFileSync(path, "utf8");
  const section = text.match(/\[vars\]\s*([\s\S]*?)(?:\n\[|$)/)?.[1] ?? "";
  const out: Record<string, string> = {};
  for (const line of section.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*) = "(.*)"/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

export function gatewayConfig() {
  const admin = loadAdminEnv();
  const dev = loadWorkerDevVars();
  const wr = loadWranglerVars();
  return {
    accountId: admin.CF_ACCOUNT_ID || wr.CF_ACCOUNT_ID || "",
    gatewayId: wr.CF_GATEWAY_ID || "",
    providerSlug: wr.PROVIDER_SLUG || "",
    dashscopeKey: admin.DASHSCOPE_API_KEY || dev.DASHSCOPE_API_KEY || "",
    cfAigToken: admin.CF_AIG_TOKEN || dev.CF_AIG_TOKEN || "",
    defaultModel: wr.DEFAULT_MODEL || admin.MODEL || "qwen-plus",
  };
}

export function hasDashScopeKey(): boolean {
  return Boolean(gatewayConfig().dashscopeKey);
}

export function hasGatewayConfig(): boolean {
  const cfg = gatewayConfig();
  return Boolean(cfg.dashscopeKey && cfg.accountId && cfg.gatewayId && cfg.providerSlug);
}

export function defaultModel(): string {
  return gatewayConfig().defaultModel.trim() || "qwen-plus";
}

/** 直连百炼 Chat Completions API。 */
export function createDashScopeClient(): OpenAI {
  const { dashscopeKey } = gatewayConfig();
  return new OpenAI({
    apiKey: dashscopeKey,
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  });
}

/** 与 admin/src/openai-llm.ts createGatewayOpenAiClient 相同 */
export function createGatewayTestClient(_kind: UpstreamKind): OpenAI {
  const cfg = gatewayConfig();
  return createGatewayOpenAiClient({
    accountId: cfg.accountId,
    gatewayId: cfg.gatewayId,
    providerSlug: cfg.providerSlug,
    apiKey: cfg.dashscopeKey,
    cfAigToken: cfg.cfAigToken || undefined,
  });
}

export function gatewayFullUrl(kind: UpstreamKind): string {
  const cfg = gatewayConfig();
  const base = gatewayCompatibleBaseUrl(cfg.accountId, cfg.gatewayId, cfg.providerSlug);
  return kind === "chat" ? `${base}/chat/completions` : `${base}/responses`;
}
