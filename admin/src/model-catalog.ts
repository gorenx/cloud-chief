import { env, reloadEnv, setEnvFileValue } from "./env";

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
    id: "qwen3-plus",
    display_name: "Qwen 3 Plus",
    family: "plus",
    supports_thinking: false,
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

const CATALOG_BY_ID = new Map(MODEL_CATALOG.map((m) => [m.id, m]));

/** 解析 admin/.env MODEL_CATALOG；留空表示使用全部内置条目 */
export function parseModelCatalogIds(raw: string): string[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function metaForId(id: string): ModelMeta {
  return (
    CATALOG_BY_ID.get(id) ?? {
      id,
      display_name: id,
      family: "other",
      supports_thinking: false,
    }
  );
}

export function lookupModel(id: string): ModelMeta | null {
  return CATALOG_BY_ID.get(id) ?? null;
}

export function builtinModelIds(): string[] {
  return MODEL_CATALOG.map((m) => m.id);
}

/** 当前生效的 catalog id 列表（不含元数据） */
export function activeModelCatalogIds(): string[] {
  const explicit = parseModelCatalogIds(env.MODEL_CATALOG);
  return explicit ?? builtinModelIds();
}

export function isInActiveCatalog(id: string): boolean {
  if (!id) return false;
  return activeModelCatalogIds().includes(id);
}

/** 计算需追加到 MODEL_CATALOG 的 id（纯函数，供测试） */
export function mergeModelCatalogIds(
  currentRaw: string,
  requiredIds: string[],
  builtinIds: string[],
): { next: string | null; added: string[] } {
  const required = [...new Set(requiredIds.filter(Boolean))];
  const explicit = parseModelCatalogIds(currentRaw);
  const effective = explicit ?? builtinIds;
  const effectiveSet = new Set(effective);
  const missing = required.filter((id) => !effectiveSet.has(id));
  if (missing.length === 0) return { next: null, added: [] };

  if (!explicit) {
    const nextIds = [...builtinIds, ...missing.filter((id) => !builtinIds.includes(id))];
    return { next: nextIds.join(","), added: missing };
  }
  return { next: [...explicit, ...missing].join(","), added: missing };
}

/** 将缺失模型 id 写入 admin/.env MODEL_CATALOG 并重载 env */
export function ensureModelCatalog(requiredIds: string[]): { added: string[] } {
  const { next, added } = mergeModelCatalogIds(
    env.MODEL_CATALOG,
    requiredIds,
    builtinModelIds(),
  );
  if (!next || added.length === 0) return { added: [] };
  if (!setEnvFileValue("MODEL_CATALOG", next)) return { added: [] };

  reloadEnv({ quiet: false });
  console.log(`📝 MODEL_CATALOG 已自动追加: ${added.join(", ")}`);
  return { added };
}

/** Playground 模型列表：由 admin/.env MODEL_CATALOG 控制 */
export function listModels(): ModelMeta[] {
  return activeModelCatalogIds().map(metaForId);
}
