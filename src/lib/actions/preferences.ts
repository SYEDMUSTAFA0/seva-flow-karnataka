"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LANGUAGE_COOKIE, LANGUAGES, type Language } from "@/lib/constants";

export async function setLanguage(formData: FormData) {
  const lang = (formData.get("lang") as Language) || "kn";
  const store = await cookies();
  store.set(LANGUAGE_COOKIE, lang === LANGUAGES.EN ? "en" : "kn", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
