import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "@/i18n/client";
import { dictFor, getLanguage } from "@/i18n";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Seva Flow Karnataka — ಸೇವಾ ಫ್ಲೋ ಕರ್ನಾಟಕ",
  description:
    "AI-assisted government workflow management for Karnataka income certificate processing. ಸರಳ ಸೇವೆ. ವೇಗದ ನಿರ್ಧಾರ. ಪಾರದರ್ಶಕ ಆಡಳಿತ.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#17233b",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLanguage();
  const dict = dictFor(lang);

  return (
    <html lang={lang} className={lang === "kn" ? "lang-kn" : ""}>
      <body className="min-h-screen bg-canvas text-ink antialiased">
        <LanguageProvider lang={lang} dict={dict}>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </LanguageProvider>
      </body>
    </html>
  );
}
