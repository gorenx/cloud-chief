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
