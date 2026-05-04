import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { cn } from "@/lib/utils.ts";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { getConversation, submitContactForm } from "@/lib/supabase-pos/contact-ops.ts";

type ChatMessage = {
  id: string;
  text: string;
  sender: "bot" | "user" | "team";
};

const historyKey = (email: string) => ["site-chat-history", email.trim().toLowerCase()] as const;

export default function ChatWidget() {
  const { t } = useTranslation("site");
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [hasInfo, setHasInfo] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const normalizedEmail = email.trim().toLowerCase();

  const historyQuery = useQuery({
    queryKey: historyKey(normalizedEmail || "—"),
    queryFn: () => getConversation(normalizedEmail),
    enabled: hasInfo && Boolean(normalizedEmail),
  });

  const serverMessages = useMemo((): ChatMessage[] => {
    const timeline = historyQuery.data?.timeline ?? [];
    const out: ChatMessage[] = [];
    for (const item of timeline) {
      if (item.kind === "reply") {
        out.push({
          id: `srv-reply-${item.id}`,
          text: item.message,
          sender: "team",
        });
      } else {
        out.push({
          id: `srv-msg-${item.id}`,
          text: item.message,
          sender: "user",
        });
      }
    }
    return out;
  }, [historyQuery.data?.timeline]);

  const displayMessages = useMemo(() => {
    const out: ChatMessage[] = [{ id: "welcome", text: t("chat.welcome"), sender: "bot" }];
    if (hasInfo) {
      out.push({ id: "user-info", text: `${name} (${email})`, sender: "user" });
      out.push({ id: "bot-ready", text: t("chat.thanks"), sender: "bot" });
      out.push(...serverMessages);
    }
    return out;
  }, [hasInfo, name, email, serverMessages, t]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages.length, isOpen]);

  const handleSubmitInfo = () => {
    if (!name.trim() || !email.trim()) {
      toast.error(t("chat.toastNameEmail"));
      return;
    }
    setHasInfo(true);
  };

  const handleSend = async () => {
    if (!input.trim() || !normalizedEmail || !name.trim()) return;
    const userMessage = input.trim();
    setInput("");
    setSending(true);
    try {
      await submitContactForm({
        name: name.trim(),
        email: normalizedEmail,
        message: userMessage,
        type: "chat",
      });
      await queryClient.invalidateQueries({ queryKey: historyKey(normalizedEmail) });
      toast.success(t("chat.toastSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("chat.toastError"));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-white shadow-lg shadow-blue-500/25 flex items-center justify-center cursor-pointer hover:shadow-blue-500/40 transition-shadow"
          >
            <MessageCircle className="size-6" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-[340px] sm:w-[380px] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-white">
              <div className="flex items-center gap-2">
                <MessageCircle className="size-5" />
                <span className="font-semibold text-sm">{t("chat.header")}</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="cursor-pointer hover:bg-white/20 rounded p-1 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[260px] max-h-[340px]">
              {displayMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                    msg.sender === "bot" && "bg-muted text-foreground",
                    msg.sender === "team" &&
                      "bg-slate-100 text-foreground border border-slate-200/80 dark:bg-slate-800 dark:border-slate-600",
                    msg.sender === "user" &&
                      "bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-white ml-auto",
                  )}
                >
                  {msg.sender === "team" ? (
                    <>
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {t("chat.teamLabel")}
                      </span>
                      <span className="mt-0.5 block whitespace-pre-wrap">{msg.text}</span>
                    </>
                  ) : (
                    msg.text
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-border">
              {!hasInfo ? (
                <div className="space-y-2">
                  <Input
                    placeholder={t("chat.namePh")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-sm"
                  />
                  <Input
                    placeholder={t("chat.emailPh")}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    className="w-full bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-white border-0"
                    onClick={handleSubmitInfo}
                  >
                    {t("chat.start")}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder={t("chat.typePh")}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) void handleSend();
                    }}
                    disabled={sending}
                    className="text-sm"
                  />
                  <Button
                    size="icon"
                    onClick={() => void handleSend()}
                    disabled={sending || !input.trim()}
                    className="bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-white border-0 shrink-0"
                  >
                    <Send className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
