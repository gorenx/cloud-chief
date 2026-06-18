import type { MessageKey, TranslateFn } from "./messages/types";

/** API 层返回的 i18n 占位 key，展示前须经 displayApiError 翻译 */
export const API_I18N_ERRORS = [
  "common.unknownError",
  "common.configReadError",
] as const satisfies readonly MessageKey[];

export type ApiI18nError = (typeof API_I18N_ERRORS)[number];

export function isApiI18nError(error: string): error is ApiI18nError {
  return (API_I18N_ERRORS as readonly string[]).includes(error);
}

export function displayApiError(t: TranslateFn, error: string): string {
  if (isApiI18nError(error)) return t(error);
  return error;
}

export function displayApiErrorValue(t: TranslateFn, error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  return displayApiError(t, msg);
}
