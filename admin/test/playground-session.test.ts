import { describe, it, expect } from "vitest";
import {
  deriveSessionFlags,
  resolveEffectiveGateway,
  resolveEffectiveModel,
  buildChatRequest,
  type PlaygroundConfigSlice,
} from "../web/src/lib/playground-session";
import { resolvePlaygroundDataView } from "../web/src/lib/playground-sources";

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

describe("resolvePlaygroundDataView", () => {
  it("worker toml mode uses wrangler sources", () => {
    const view = resolvePlaygroundDataView(
      { isWorker: true, useWorkerToml: true, modelLocked: true, gatewayLocked: true },
      FIELDS,
    );
    expect(view.routingSection).toBe("worker");
    expect(view.controls.model.source).toBe("wrangler");
    expect(view.controls.gateway?.source).toBe("wrangler");
    expect(view.showGatewayContext).toBe(false);
  });

  it("gateway mode uses cf and env", () => {
    const view = resolvePlaygroundDataView(
      { isWorker: false, useWorkerToml: false, modelLocked: false, gatewayLocked: false },
      FIELDS,
    );
    expect(view.controls.request.source).toBe("env");
    expect(view.controls.gateway?.source).toBe("cf");
    expect(view.controls.model.source).toBe("env");
  });
});

describe("playground-session", () => {
  it("deriveSessionFlags for worker toml mode", () => {
    expect(deriveSessionFlags("worker", "worker")).toEqual({
      isWorker: true,
      useWorkerToml: true,
      modelLocked: true,
      gatewayLocked: true,
    });
  });

  it("deriveSessionFlags for worker ui mode", () => {
    expect(deriveSessionFlags("worker", "ui")).toEqual({
      isWorker: true,
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

  it("buildChatRequest for worker with use_worker_config", () => {
    const r = buildChatRequest({
      callMode: "worker",
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
