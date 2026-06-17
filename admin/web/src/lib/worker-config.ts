import { toast } from "sonner";

export interface WorkerVarRow {
  k: string;
  v: string;
}

export interface WorkerSecretRowState {
  name: string;
  value: string;
  fixed: boolean;
  optional: boolean;
}

const ENV_KEY_RE = /^[A-Z][A-Z0-9_]*$/;

export function buildVarsObject(rows: WorkerVarRow[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const { k, v } of rows) {
    if (!k.trim()) continue;
    if (!ENV_KEY_RE.test(k.trim())) throw new Error(`变量名 ${k} 非法`);
    obj[k.trim()] = v;
  }
  if (Object.keys(obj).length === 0) throw new Error("请至少填写一个变量");
  return obj;
}

/** 线上 vars 行：与本地键序对齐，缺失或空值均显示为空字符串 */
export function buildOnlineVarRows(
  onlineVars: Record<string, string>,
  localRows?: WorkerVarRow[],
  alignWithLocal?: boolean,
): WorkerVarRow[] {
  const localKeys = (localRows ?? []).map((r) => r.k.trim()).filter(Boolean);

  if (alignWithLocal && localKeys.length > 0) {
    const seen = new Set<string>();
    const rows: WorkerVarRow[] = [];
    for (const k of localKeys) {
      seen.add(k);
      rows.push({ k, v: onlineVars[k] ?? "" });
    }
    for (const k of Object.keys(onlineVars).sort()) {
      if (!seen.has(k)) rows.push({ k, v: onlineVars[k] });
    }
    return rows;
  }

  return Object.entries(onlineVars)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => ({ k, v }));
}

export function collectWorkerSecrets(
  rows: WorkerSecretRowState[],
): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const s of rows) {
    if (!s.name.trim() || !s.value) continue;
    if (!ENV_KEY_RE.test(s.name.trim())) {
      toast.error(`Secret 名 ${s.name} 非法`);
      return null;
    }
    out[s.name.trim()] = s.value;
  }
  return out;
}
