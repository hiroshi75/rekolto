import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { getLocale, htmlLang } from "@/lib/locale";
import { getDict } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Rekolto",
  description: "Personal knowledge base",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = getDict(locale);

  return (
    <html lang={htmlLang(locale)}>
      <body className="min-h-screen flex">
        <Sidebar dict={t} locale={locale} />
        <main className="flex-1 ml-56 px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </body>
    </html>
  );
}
