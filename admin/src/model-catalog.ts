export type ModelFamily = "max" | "plus" | "flash" | "coder" | "other";

export interface ModelMeta {
  id: string;
  display_name: string;
  family: ModelFamily;
  supports_thinking: boolean;
  notes?: string;
}

export const MODEL_CATALOG: ModelMeta[] = [
  {
    id: "qwen3.7-max",
    display_name: "Qwen 3.7 Max",
    family: "max",
    supports_thinking: true,
    notes: "旗舰推理，复杂任务建议开启思考模式",
  },
  {
    id: "qwen3.7-max-2026-05-20",
    display_name: "Qwen 3.7 Max (2026-05-20)",
    family: "max",
    supports_thinking: true,
  },
  {
    id: "qwen3.7-max-2026-06-08",
    display_name: "Qwen 3.7 Max (2026-06-08)",
    family: "max",
    supports_thinking: true,
  },
  {
    id: "qwen3-max",
    display_name: "Qwen 3 Max",
    family: "max",
    supports_thinking: true,
    notes: "默认推荐；Responses API 不支持无版本 qwen-max",
  },
  {
    id: "qwen3-max-2026-01-23",
    display_name: "Qwen 3 Max (2026-01-23)",
    family: "max",
    supports_thinking: true,
  },
  {
    id: "qwen3.7-plus",
    display_name: "Qwen 3.7 Plus",
    family: "plus",
    supports_thinking: false,
  },
  {
    id: "qwen3.7-plus-2026-05-26",
    display_name: "Qwen 3.7 Plus (2026-05-26)",
    family: "plus",
    supports_thinking: false,
  },
  {
    id: "qwen3.6-plus",
    display_name: "Qwen 3.6 Plus",
    family: "plus",
    supports_thinking: false,
  },
  {
    id: "qwen3.5-plus",
    display_name: "Qwen 3.5 Plus",
    family: "plus",
    supports_thinking: false,
  },
  {
    id: "qwen-plus",
    display_name: "Qwen Plus",
    family: "plus",
    supports_thinking: false,
  },
  {
    id: "qwen3.6-flash",
    display_name: "Qwen 3.6 Flash",
    family: "flash",
    supports_thinking: false,
    notes: "低延迟、高性价比",
  },
  {
    id: "qwen3.5-flash",
    display_name: "Qwen 3.5 Flash",
    family: "flash",
    supports_thinking: false,
  },
  {
    id: "qwen-flash",
    display_name: "Qwen Flash",
    family: "flash",
    supports_thinking: false,
  },
  {
    id: "qwen3-coder-plus",
    display_name: "Qwen 3 Coder Plus",
    family: "coder",
    supports_thinking: false,
    notes: "代码生成优化",
  },
  {
    id: "qwen3-coder-flash",
    display_name: "Qwen 3 Coder Flash",
    family: "coder",
    supports_thinking: false,
  },
];

export function lookupModel(id: string): ModelMeta | null {
  return MODEL_CATALOG.find((m) => m.id === id) ?? null;
}

export function listModels(): ModelMeta[] {
  return MODEL_CATALOG;
}
