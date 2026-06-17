import type { ResponseMeta } from "@/types";

export function pickFields(meta: ResponseMeta | undefined) {
  return meta?.fields ?? {};
}
