import { describe, it, expect } from "vitest";
import {
  deriveSessionFlags,
  resolveEffectiveGateway,
  resolveEffectiveModel,
  resolveInspectTarget,
  resolveRequestPath,
  buildChatRequest,
  type PlaygroundConfigSlice,
} from "../web/src/lib/playground-session";
import { resolvePlaygroundDataView } from "../web/src/lib/playground-sources";
import { translate } from "../web/src/i18n";

const t = (key: Parameters<typeof translate>[1], vars?: Parameters<typeof translate>[2]) =>
  translate("zh", key, vars);

const baseConfig: PlaygroundConfigSlice = {
  model: "qwen-plus",
  worker_routing: { gateway: "qwen-gw", default_model: "qwen3-plus" },
};

const FIELDS = {
  gateways: { source: "cf" as const },
  models: { source: "env" as const, key: "MODEL_CATALOG" },
  gateway: { source: "cf" as const },
  "worker_routing.default_model": { source: "wrangler" as const, key: "DEFAULT_MODEL" },
  "worker_routing.gateway": { source: "wrangler" as const, key: "CF_GATEWAY_ID" },
  "worker.authorization": { source: "derived" as const },
  "chat.authorization": { source: "env" as const, key: "DASHSCOPE_API_KEY" },
};

describe("resolveInspectTarget / resolveRequestPath", () => {
  it("maps tabs to gateway or worker inspect targets", () => {
    expect(resolveInspectTarget("gateway", "worker")).toBe("gateway");
    expect(resolveInspectTarget("worker", "gateway")).toBe("worker");
    expect(resolveInspectTarget("chat", "gateway")).toBe("gateway");
    expect(resolveInspectTarget("chat", "worker")).toBe("worker");
  });

  it("maps tabs to request paths", () => {
    expect(resolveRequestPath("gateway", "worker")).toBe("gateway");
    expect(resolveRequestPath("worker", "gateway")).toBe("worker");
    expect(resolveRequestPath("chat", "worker")).toBe("worker");
  });
});

describe("resolvePlaygroundDataView", () => {
  it("worker toml mode uses wrangler sources", () => {
    const flags = deriveSessionFlags("worker", "worker");
    const view = resolvePlaygroundDataView("worker", flags, FIELDS, t);
    expect(view.routingSection).toBe("worker");
    expect(view.controls.model.source).toBe("wrangler");
    expect(view.controls.gateway?.source).toBe("wrangler");
    expect(view.showGatewayContext).toBe(false);
  });

  it("gateway mode uses cf and env", () => {
    const flags = deriveSessionFlags("gateway", "ui");
    const view = resolvePlaygroundDataView("gateway", flags, FIELDS, t);
    expect(view.controls.request.source).toBe("env");
    expect(view.controls.gateway?.source).toBe("cf");
    expect(view.controls.model.source).toBe("env");
  });
});

describe("playground-session", () => {
  it("deriveSessionFlags for worker toml mode", () => {
    expect(deriveSessionFlags("worker", "worker")).toEqual({
      useWorkerToml: true,
      modelLocked: true,
      gatewayLocked: true,
    });
  });

  it("deriveSessionFlags for worker ui mode", () => {
    expect(deriveSessionFlags("worker", "ui")).toEqual({
      useWorkerToml: false,
      modelLocked: false,
      gatewayLocked: false,
    });
  });

  it("deriveSessionFlags for gateway inspect target", () => {
    expect(deriveSessionFlags("gateway", "worker")).toEqual({
      useWorkerToml: false,
      modelLocked: false,
      gatewayLocked: false,
    });
  });

  it("resolveEffectiveModel uses wrangler or ui model", () => {
    expect(resolveEffectiveModel(baseConfig, "qwen3.7-max", true)).toBe("qwen3-plus");
    expect(resolveEffectiveModel(baseConfig, "qwen3.7-max", false)).toBe("qwen3.7-max");
  });

  it("resolveEffectiveGateway uses wrangler or ui gateway", () => {
    expect(resolveEffectiveGateway(baseConfig, "other-gw", true)).toBe("qwen-gw");
    expect(resolveEffectiveGateway(baseConfig, "other-gw", false)).toBe("other-gw");
  });

  it("buildChatRequest for gateway path", () => {
    const r = buildChatRequest({
      path: "gateway",
      effectiveModel: "qwen-plus",
      messages: [{ role: "user", content: "hi" }],
      gateway: "my-gw",
      providerSlug: "dashscope",
      useWorkerToml: false,
    });
    expect(r.url).toBe("/api/chat");
    expect(r.body.gateway).toBe("my-gw");
    expect(r.body.provider_slug).toBe("dashscope");
  });

  it("buildChatRequest for worker with use_worker_config", () => {
    const r = buildChatRequest({
      path: "worker",
      effectiveModel: "qwen3-plus",
      messages: [],
      gateway: "gw",
      workerAccessToken: "",
      useWorkerToml: true,
    });
    expect(r.url).toBe("/api/worker-chat");
    expect(r.body.use_worker_config).toBe(true);
  });
});
