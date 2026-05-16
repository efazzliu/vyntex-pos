import { motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible.tsx";
import { cn } from "@/lib/utils.ts";

const FAQ_KEYS = [
  "trial",
  "credit_card",
  "devices",
  "offline",
  "locations",
  "data_security",
  "payments",
  "support",
] as const;

function FaqRow({ itemKey, index }: { itemKey: (typeof FAQ_KEYS)[number]; index: number }) {
  const { t } = useTranslation("site");
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      className="rounded-xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden"
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/30 transition-colors">
          <span className="font-medium text-foreground pr-2">{t(`home.faq.items.${itemKey}.q`)}</span>
          <ChevronDown
            className={cn(
              "size-5 shrink-0 text-primary transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-5 pb-4 pt-0 text-sm leading-relaxed text-muted-foreground border-t border-border/60">
            <p className="pt-3">{t(`home.faq.items.${itemKey}.a`)}</p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </motion.div>
  );
}

export default function FaqSection() {
  const { t } = useTranslation("site");

  return (
    <section className="py-24 sm:py-32 bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-sm font-semibold tracking-widest uppercase bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent">
              {t("home.faq.label")}
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              {t("home.faq.title")}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">{t("home.faq.subtitle")}</p>
          </motion.div>
        </div>

        <div className="flex flex-col gap-3">
          {FAQ_KEYS.map((key, i) => (
            <FaqRow key={key} itemKey={key} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
