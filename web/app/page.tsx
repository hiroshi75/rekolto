import { getLocale } from "@/lib/locale";
import { getDict } from "@/lib/i18n";
import { NewChatInput } from "@/components/chat-bubble";

export default async function NewChatPage() {
  const locale = await getLocale();
  const t = getDict(locale);

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
      <h1 className="text-3xl font-bold text-white mb-2">Rekolto</h1>
      <p className="text-muted mb-8">{t.chat_empty}</p>
      <div className="w-full max-w-2xl">
        <NewChatInput dict={t} />
      </div>
    </div>
  );
}
