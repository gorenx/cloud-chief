import { describe, it, expect } from "vitest";
import {
  deriveSessionFlags,
  resolveEffectiveGateway,
  resolveEffectiveModel,
  resolveInspectTarget,
  resolveRequestPath,
  resolveShowGatewayModelControls,
  resolveWorkerTierModels,
  buildChatRequest,
  type PlaygroundConfigSlice,
  type WorkerCapabilities,
} from "../web/src/lib/playground-session";
import { resolvePlaygroundDataView } from "../web/src/lib/playground-sources";
import { translate } from "../web/src/i18n";

const t = (key: Parameters<typeof translate>[1], vars?: Parameters<typeof translate>[2]) =>
  translate("zh", key, vars);

const AI_CAPS: WorkerCapabilities = {
  uses_gateway: true,
  uses_model: true,
  supports_chat: true,
};

const API_CAPS: WorkerCapabilities = {
  uses_gateway: false,
  uses_model: false,
  supports_chat: false,
};

const baseConfig: PlaygroundConfigSlice = {
  model: "qwen-plus",
  worker_routing: {
    gateway: "qwen-gw",
    default_model: "qwen-plus",
    free_model: "qwen-plus",
    plus_model: "qwen3-max",
  },
};

const FIELDS = {
  gateways: { source: "cf" as const },
  models: { source: "env" as const, key: "MODEL_CATALOG" },
  gateway: { source: "cf" as const },
  "worker.url": { source: "wrangler" as const },
  "worker_routing.default_model": { source: "wrangler" as const, key: "DEFAULT_MODEL" },
  "worker_routing.free_model": { source: "wrangler" as const, key: "FREE_MODEL" },
  "worker_routing.plus_model": { source: "wrangler" as const, key: "PLUS_MODEL" },
  "worker_routing.gateway": { source: "wrangler" as const, key: "CF_GATEWAY_ID" },
  "worker.authorization": { source: "derived" as const },
  "chat.authorization": { source: "env" as const, key: "DASHSCOPE_API_KEY" },
};

describe("resolveShowGatewayModelControls", () => {
  it("always shows on gateway tab", () => {
    expect(resolveShowGatewayModelControls("gateway", API_CAPS)).toBe(true);
  });

  it("auto hides when worker lacks gateway/model vars", () => {
    expect(resolveShowGatewayModelControls("worker", API_CAPS)).toBe(false);
    expect(resolveShowGatewayModelControls("worker", AI_CAPS)).toBe(true);
  });
});

describe("resolvePlaygroundDataView", () => {
  it("api-only worker hides gateway and model controls", () => {
    const flags = deriveSessionFlags("worker", "worker", API_CAPS);
    const view = resolvePlaygroundDataView("worker", flags, FIELDS, t);
    expect(view.routingSection).toBe("api");
    expect(view.hideGatewayModel).toBe(true);
    expect(view.controls.model).toBeUndefined();
  });
});

describe("playground-session", () => {
  it("deriveSessionFlags for api-only worker auto mode", () => {
    expect(deriveSessionFlags("worker", "worker", API_CAPS)).toEqual({
      useWorkerToml: false,
      modelLocked: false,
      gatewayLocked: false,
      workerModelEnforced: false,
      hideGatewayModel: true,
      supportsChat: false,
    });
  });

  it("deriveSessionFlags for ai gateway worker", () => {
    expect(deriveSessionFlags("worker", "worker", AI_CAPS)).toMatchObject({
      useWorkerToml: true,
      modelLocked: false,
      hideGatewayModel: false,
      supportsChat: true,
      workerModelEnforced: true,
    });
  });

  it("resolveEffectiveModel uses ui selection on worker path", () => {
    const flags = deriveSessionFlags("worker", "ui", AI_CAPS);
    expect(resolveEffectiveModel(baseConfig, "qwen3.7-max", flags)).toBe("qwen3.7-max");
  });

  it("buildChatRequest for worker with use_worker_config", () => {
    const r = buildChatRequest({
      path: "worker",
      effectiveModel: "qwen-plus",
      messages: [],
      gateway: "gw",
      workerAccessToken: "",
      useWorkerToml: true,
    });
    expect(r.url).toBe("/api/worker-chat");
    expect(r.body.use_worker_config).toBe(true);
  });
});

describe("resolveInspectTarget / resolveRequestPath", () => {
  it("maps tabs to gateway or worker inspect targets", () => {
    expect(resolveInspectTarget("gateway", "worker")).toBe("gateway");
    expect(resolveInspectTarget("worker", "gateway")).toBe("worker");
  });
});

describe("resolveWorkerTierModels", () => {
  it("prefers FREE_MODEL and PLUS_MODEL", () => {
    expect(resolveWorkerTierModels(baseConfig)).toEqual({
      free: "qwen-plus",
      plus: "qwen3-max",
    });
  });
});

describe("resolveEffectiveGateway", () => {
  it("uses wrangler or ui gateway", () => {
    expect(resolveEffectiveGateway(baseConfig, "other-gw", true)).toBe("qwen-gw");
    expect(resolveEffectiveGateway(baseConfig, "other-gw", false)).toBe("other-gw");
  });
});
