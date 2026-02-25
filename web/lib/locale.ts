import { cookies } from "next/headers";
import { type Locale, DEFAULT_LOCALE, isLocale } from "./i18n";

const COOKIE_NAME = "rekolto_locale";

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const val = jar.get(COOKIE_NAME)?.value;
  if (val && isLocale(val)) return val;
  return DEFAULT_LOCALE;
}

/** HTML lang attribute value (e.g. "en", "ja", "zh-CN" → "zh-Hans") */
export function htmlLang(locale: Locale): string {
  const map: Record<string, string> = {
    "zh-CN": "zh-Hans",
    "zh-TW": "zh-Hant",
    "pt-BR": "pt-BR",
  };
  return map[locale] ?? locale;
}
