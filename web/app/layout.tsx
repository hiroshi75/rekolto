import type { Metadata } from "next";
import "./globals.css";
import { ChatSidebar } from "@/components/chat-sidebar";
import { getLocale, htmlLang } from "@/lib/locale";
import { getDict } from "@/lib/i18n";
import { getChatSessions } from "@/lib/db-chat";

export const metadata: Metadata = {
  title: "Rekolto",
  description: "Personal knowledge base",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = getDict(locale);
  const sessions = getChatSessions();

  return (
    <html lang={htmlLang(locale)}>
      <body className="min-h-screen flex">
        <ChatSidebar dict={t} sessions={sessions} />
        <main className="flex-1 ml-64 px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </body>
    </html>
  );
}
