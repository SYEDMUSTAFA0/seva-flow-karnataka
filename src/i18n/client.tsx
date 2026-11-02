"use client";

import { createContext, useContext } from "react";
import type { Dict } from "./en";
import type { Language } from "@/lib/constants";

const I18nContext = createContext<{ lang: Language; t: Dict }>({
  lang: "kn",
  t: {} as Dict,
});

export function LanguageProvider({
  lang,
  dict,
  children,
}: {
  lang: Language;
  dict: Dict;
  children: React.ReactNode;
}) {
  return <I18nContext.Provider value={{ lang, t: dict }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
