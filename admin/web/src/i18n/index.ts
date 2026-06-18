import { enMessages } from "./messages/en";
import { zhMessages } from "./messages/zh";
import type { MessageKey, TranslateVars } from "./messages/types";

export type {
  MessageKey,
  Messages,
  TranslateFn,
  TranslateVars,
} from "./messages/types";

export type Locale = "zh" | "en";

export const LOCALES: { id: Locale; label: string }[] = [
  { id: "zh", label: "中文" },
  { id: "en", label: "English" },
];

export const messages: Record<Locale, typeof zhMessages> = {
  zh: zhMessages,
  en: enMessages,
};

export function isLocale(value: string): value is Locale {
  return value === "zh" || value === "en";
}

export const LOCALE_STORAGE_KEY = "admin_locale";

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: TranslateVars,
): string {
  const parts = key.split(".");
  let cur: unknown = messages[locale];
  for (const part of parts) {
    if (!cur || typeof cur !== "object" || !(part in cur)) return key;
    cur = (cur as Record<string, unknown>)[part];
  }
  let text = typeof cur === "string" ? cur : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}
