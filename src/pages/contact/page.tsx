import { useState } from "react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Mail, MessageSquare, Clock } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import PageHeader from "@/components/page-header.tsx";
import { toast } from "sonner";
import { submitContactForm } from "@/lib/supabase-pos/contact-ops.ts";
import {
  SUPPORT_BUSINESS_EMAIL_READY,
  SUPPORT_EMAIL,
  SUPPORT_MAILTO_HREF,
} from "@/lib/site-constants.ts";

export default function ContactPage() {
  const { t } = useTranslation("site");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error(t("contact.toastRequired"));
      return;
    }
    setIsSubmitting(true);
    try {
      await submitContactForm({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim() || undefined,
        message: message.trim(),
        type: "form",
      });
      toast.success(t("contact.toastSuccess"));
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("contact.toastError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        badge={t("contact.badge")}
        title={t("contact.title")}
        subtitle={t("contact.subtitle")}
      />

      <section className="pb-24 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-3"
            >
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact-name">{t("contact.name")}</Label>
                    <Input
                      id="contact-name"
                      placeholder={t("contact.phName")}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-email">{t("contact.email")}</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder={t("contact.phEmail")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-subject">{t("contact.subject")}</Label>
                  <Input
                    id="contact-subject"
                    placeholder={t("contact.phSubject")}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-message">{t("contact.message")}</Label>
                  <Textarea
                    id="contact-message"
                    placeholder={t("contact.phMessage")}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-[#0066FF] to-[#00AACC] hover:from-[#0055DD] hover:to-[#0099BB] text-white border-0"
                >
                  {isSubmitting ? t("contact.sending") : t("contact.send")}
                </Button>
              </form>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="lg:col-span-2 space-y-6"
            >
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={
                      SUPPORT_BUSINESS_EMAIL_READY
                        ? "w-10 h-10 rounded-lg bg-gradient-to-br from-[#0066FF]/10 to-[#44CC00]/10 flex items-center justify-center"
                        : "w-10 h-10 rounded-lg bg-muted flex items-center justify-center"
                    }
                  >
                    <Mail
                      className={
                        SUPPORT_BUSINESS_EMAIL_READY
                          ? "size-5 text-primary"
                          : "size-5 text-muted-foreground"
                      }
                    />
                  </div>
                  <h3 className="font-semibold text-foreground">{t("contact.emailUs")}</h3>
                </div>
                {SUPPORT_BUSINESS_EMAIL_READY ? (
                  <a
                    href={SUPPORT_MAILTO_HREF}
                    className="text-sm text-primary font-medium hover:underline"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                ) : (
                  <p role="status" className="text-sm text-muted-foreground leading-relaxed">
                    {t("contact.emailUnavailableBody")}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0066FF]/10 to-[#44CC00]/10 flex items-center justify-center">
                    <MessageSquare className="size-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">{t("contact.liveChat")}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{t("contact.liveChatBody")}</p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0066FF]/10 to-[#44CC00]/10 flex items-center justify-center">
                    <Clock className="size-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">{t("contact.responseTime")}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{t("contact.responseBody")}</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </>
  );
}
