import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { en, type Dict } from "./en";
import { kn } from "./kn";
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE, type Language } from "@/lib/constants";

export type { Dict };
export { en, kn };

export const dictionaries: Record<Language, Dict> = { en, kn };

export function resolveLanguage(raw: string | undefined | null): Language {
  return raw === "en" ? "en" : raw === "kn" ? "kn" : DEFAULT_LANGUAGE;
}

/** Read the current language from the cookie — default Kannada. */
export const getLanguage = cache(async (): Promise<Language> => {
  const store = await cookies();
  return resolveLanguage(store.get(LANGUAGE_COOKIE)?.value);
});

export const getDict = cache(async (): Promise<Dict> => {
  const lang = await getLanguage();
  return dictionaries[lang];
});

export function dictFor(lang: Language): Dict {
  return dictionaries[lang];
}
