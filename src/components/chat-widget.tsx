import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { cn } from "@/lib/utils.ts";
import { motion, AnimatePresence } from "motion/react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";

type ChatMessage = {
  id: string;
  text: string;
  sender: "bot" | "user";
};

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  text: "Hi! Welcome to VYNTEX support. Please enter your name and email to get started.",
  sender: "bot",
};

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [hasInfo, setHasInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const submitChat = useMutation(api.contact.submitForm);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmitInfo = () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Please enter your name and email");
      return;
    }
    setHasInfo(true);
    setMessages((prev) => [
      ...prev,
      {
        id: `user-info-${Date.now()}`,
        text: `${name} (${email})`,
        sender: "user",
      },
      {
        id: `bot-ready-${Date.now()}`,
        text: "Thanks! How can we help you today?",
        sender: "bot",
      },
    ]);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = input.trim();
    setInput("");

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, text: userMessage, sender: "user" },
    ]);

    try {
      await submitChat({
        name,
        email,
        message: userMessage,
        type: "chat",
      });

      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-reply-${Date.now()}`,
            text: "Thanks for your message! Our team will review it and get back to you shortly.",
            sender: "bot",
          },
        ]);
      }, 1000);
    } catch {
      toast.error("Failed to send message. Please try again.");
    }
  };

  return (
    <>
      {/* Floating chat button */}
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

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-[340px] sm:w-[380px] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-white">
              <div className="flex items-center gap-2">
                <MessageCircle className="size-5" />
                <span className="font-semibold text-sm">VYNTEX Support</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="cursor-pointer hover:bg-white/20 rounded p-1 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[260px] max-h-[340px]">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                    msg.sender === "bot"
                      ? "bg-muted text-foreground"
                      : "bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-white ml-auto"
                  )}
                >
                  {msg.text}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-3 border-t border-border">
              {!hasInfo ? (
                <div className="space-y-2">
                  <Input
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-sm"
                  />
                  <Input
                    placeholder="Your email"
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
                    Start Chat
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSend();
                    }}
                    className="text-sm"
                  />
                  <Button
                    size="icon"
                    onClick={handleSend}
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
