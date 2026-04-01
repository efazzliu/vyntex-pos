import { useState } from "react";
import { motion } from "motion/react";
import { Mail, MessageSquare, Clock } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import PageHeader from "@/components/page-header.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { toast } from "sonner";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitForm = useMutation(api.contact.submitForm);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsSubmitting(true);
    try {
      await submitForm({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim() || undefined,
        message: message.trim(),
        type: "form",
      });
      toast.success("Message sent! We'll get back to you soon.");
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        badge="Contact"
        title="Get in touch"
        subtitle="Have a question or need help? Reach out and our team will respond within 24 hours."
      />

      <section className="pb-24 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            {/* Form */}
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
                    <Label htmlFor="contact-name">Name *</Label>
                    <Input
                      id="contact-name"
                      placeholder="John Smith"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-email">Email *</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder="john@restaurant.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-subject">Subject</Label>
                  <Input
                    id="contact-subject"
                    placeholder="How can we help?"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-message">Message *</Label>
                  <Textarea
                    id="contact-message"
                    placeholder="Tell us about your needs..."
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
                  {isSubmitting ? "Sending..." : "Send Message"}
                </Button>
              </form>
            </motion.div>

            {/* Contact info cards */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="lg:col-span-2 space-y-6"
            >
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0066FF]/10 to-[#44CC00]/10 flex items-center justify-center">
                    <Mail className="size-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">Email Us</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  support@vyntex.com
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0066FF]/10 to-[#44CC00]/10 flex items-center justify-center">
                    <MessageSquare className="size-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">Live Chat</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Click the chat icon in the bottom-right corner for instant
                  assistance from our support team.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0066FF]/10 to-[#44CC00]/10 flex items-center justify-center">
                    <Clock className="size-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">
                    Response Time
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  We typically respond within 24 hours on business days.
                  Enterprise clients get priority support.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </>
  );
}
