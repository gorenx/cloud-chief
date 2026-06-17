import { describe, it, expect, afterEach } from "vitest";
import {
  listModels,
  parseModelCatalogIds,
  lookupModel,
  mergeModelCatalogIds,
  builtinModelIds,
} from "../src/model-catalog";
import { env } from "../src/env";

describe("model-catalog", () => {
  const prev = env.MODEL_CATALOG;

  afterEach(() => {
    env.MODEL_CATALOG = prev;
  });

  it("parseModelCatalogIds splits comma-separated ids", () => {
    expect(parseModelCatalogIds("qwen3-max, qwen-plus")).toEqual(["qwen3-max", "qwen-plus"]);
    expect(parseModelCatalogIds("")).toBeNull();
    expect(parseModelCatalogIds("  ")).toBeNull();
  });

  it("listModels returns full catalog when MODEL_CATALOG unset", () => {
    env.MODEL_CATALOG = "";
    expect(listModels().length).toBe(builtinModelIds().length);
    expect(listModels().some((m) => m.id === "qwen3-plus")).toBe(true);
  });

  it("listModels filters by admin/.env MODEL_CATALOG", () => {
    env.MODEL_CATALOG = "qwen3-plus,qwen-plus";
    const models = listModels();
    expect(models.map((m) => m.id)).toEqual(["qwen3-plus", "qwen-plus"]);
    expect(models[0].display_name).toBe("Qwen 3 Plus");
  });

  it("mergeModelCatalogIds appends to explicit list", () => {
    const r = mergeModelCatalogIds("qwen-plus", ["qwen3-plus"], builtinModelIds());
    expect(r.added).toEqual(["qwen3-plus"]);
    expect(r.next).toBe("qwen-plus,qwen3-plus");
  });

  it("mergeModelCatalogIds materializes builtin when empty and custom id required", () => {
    const r = mergeModelCatalogIds("", ["custom-model"], builtinModelIds());
    expect(r.added).toEqual(["custom-model"]);
    expect(r.next?.split(",")).toContain("custom-model");
    expect(r.next?.split(",")).toContain("qwen3-max");
  });

  it("mergeModelCatalogIds no-op when already present", () => {
    const r = mergeModelCatalogIds("qwen3-plus,qwen-plus", ["qwen3-plus"], builtinModelIds());
    expect(r.added).toEqual([]);
    expect(r.next).toBeNull();
  });

  it("listModels uses raw id for unknown entries in MODEL_CATALOG", () => {
    env.MODEL_CATALOG = "custom-model-id";
    const models = listModels();
    expect(models).toEqual([
      {
        id: "custom-model-id",
        display_name: "custom-model-id",
        family: "other",
        supports_thinking: false,
      },
    ]);
    expect(lookupModel("custom-model-id")).toBeNull();
  });
});
