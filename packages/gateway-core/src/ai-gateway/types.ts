export type SpendFreeResult =
  | { granted: true; used: number; quota: number }
  | { granted: false; reason: "throttled" | "over_quota"; used: number; quota: number };
