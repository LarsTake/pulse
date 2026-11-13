// Interface language. One per server: `PULSE_LOCALE=de` in .env (default English). The server reads the env; the
// browser reads <html lang>, which the root layout sets from the same env, so server and client render the same text.
//
// `t()` takes the English text as its key. A missing translation falls back to English, so a new string never shows
// blank. Placeholders are `{0}`, `{1}`… for the values passed in `args`.
import { de } from "@/i18n/de";

export type Locale = "en" | "de";

function detect(): Locale {
  if (typeof document !== "undefined") return document.documentElement.lang?.startsWith("de") ? "de" : "en";
  const env = (typeof process !== "undefined" && (process.env.PULSE_LOCALE || process.env.NEXT_PUBLIC_PULSE_LOCALE)) || "";
  return env.toLowerCase().startsWith("de") ? "de" : "en";
}

/** The interface language, fixed for the process (server) or the page (browser). */
export const UI_LOCALE: Locale = detect();
/** BCP 47 tag for Intl formatters. */
export const INTL_LOCALE = UI_LOCALE === "de" ? "de-DE" : "en-US";

// Keys are matched with non-breaking spaces read as plain spaces, so "8\u00a0hours" in the source finds "8 hours".
const plain = (s: string) => (s.includes("\u00a0") ? s.replace(/\u00a0/g, " ") : s);
const DICT: Record<Locale, Map<string, string> | null> = { en: null, de: new Map(Object.entries(de).map(([k, v]) => [plain(k), v])) };

/** Translates `en` (its own key) and fills `{0}`, `{1}`… from `args`. */
export function t(en: string, args?: readonly unknown[]): string {
  const s = DICT[UI_LOCALE]?.get(plain(en)) ?? en;
  return args?.length ? s.replace(/\{(\d+)\}/g, (m, i) => (Number(i) < args.length ? String(args[Number(i)]) : m)) : s;
}
