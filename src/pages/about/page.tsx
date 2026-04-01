import { motion } from "motion/react";
import { Shield, Zap, Heart, Globe } from "lucide-react";
import PageHeader from "@/components/page-header.tsx";

const values = [
  {
    icon: Zap,
    title: "Innovation First",
    description:
      "We push the boundaries of what POS systems can do, leveraging cutting-edge technology to deliver exceptional experiences.",
  },
  {
    icon: Shield,
    title: "Reliability",
    description:
      "99.9% uptime guarantee. Your business depends on us, and we take that responsibility seriously.",
  },
  {
    icon: Heart,
    title: "Customer Obsession",
    description:
      "Every feature we build starts with a real problem faced by real restaurant operators. Your feedback drives our roadmap.",
  },
  {
    icon: Globe,
    title: "Global Vision",
    description:
      "Built for businesses worldwide. Multi-currency, multi-language, and compliant with local regulations in 45+ countries.",
  },
];

const milestones = [
  { year: "2021", event: "VYNTEX founded with a mission to modernize restaurant POS" },
  { year: "2022", event: "Launched Restaurant POS with first 100 customers" },
  { year: "2023", event: "Expanded to 20+ countries, 1,000 restaurants" },
  { year: "2024", event: "Processed 5 million+ transactions, Series A funding" },
  { year: "2025", event: "2,500+ restaurants across 45 countries" },
  { year: "2026", event: "Launching Coffee, Bar, Hotel, and Fitness POS" },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        badge="About"
        title="Building the future of hospitality technology"
        subtitle="VYNTEX was founded with a simple mission: make restaurant technology as elegant as the dining experiences it powers."
      />

      <section className="pb-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Story */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center mb-20"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">
              Our Story
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We started VYNTEX because we saw an industry stuck with outdated,
              clunky systems that frustrated both staff and customers.
              Restaurants deserve technology that works as hard as they do.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Today, VYNTEX powers thousands of restaurants across 45+
              countries, processing millions of transactions every month. But
              {"we're"} just getting started — our vision extends beyond restaurants
              to every hospitality business that deserves better tools.
            </p>
          </motion.div>

          {/* Values */}
          <div className="mb-20">
            <h3 className="text-sm font-semibold tracking-widest uppercase bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent text-center mb-10">
              Our Values
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {values.map((value, i) => (
                <motion.div
                  key={value.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="rounded-xl border border-border bg-card p-6"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0066FF]/10 to-[#44CC00]/10 flex items-center justify-center">
                      <value.icon className="size-5 text-primary" />
                    </div>
                    <h4 className="text-lg font-semibold text-foreground">
                      {value.title}
                    </h4>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {value.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <h3 className="text-sm font-semibold tracking-widest uppercase bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent text-center mb-10">
              Our Journey
            </h3>
            <div className="max-w-2xl mx-auto space-y-0">
              {milestones.map((m, i) => (
                <motion.div
                  key={m.year}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="flex gap-6 pb-8 last:pb-0"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-[#0066FF] to-[#44CC00] shrink-0 mt-1.5" />
                    {i < milestones.length - 1 && (
                      <div className="w-px flex-1 bg-border mt-2" />
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-primary">
                      {m.year}
                    </span>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {m.event}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
