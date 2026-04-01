import { motion } from "motion/react";
import {
  ClipboardList,
  CreditCard,
  BarChart3,
  Package,
  MapPin,
  LayoutGrid,
} from "lucide-react";

const features = [
  {
    icon: ClipboardList,
    title: "Smart Order Management",
    description:
      "Handle dine-in, takeaway, and delivery orders seamlessly. Real-time kitchen display integration keeps your team in sync.",
  },
  {
    icon: CreditCard,
    title: "Seamless Payments",
    description:
      "Accept every payment method — card, cash, mobile wallets, and split bills. Fast checkout means happier customers.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    description:
      "Track sales, peak hours, and staff performance with live dashboards. Make data-driven decisions instantly.",
  },
  {
    icon: Package,
    title: "Inventory Control",
    description:
      "Automatic stock tracking with low-inventory alerts. Never run out of ingredients during a rush again.",
  },
  {
    icon: MapPin,
    title: "Multi-Location Management",
    description:
      "Manage all your locations from a single dashboard. Unified reporting and centralized menu control.",
  },
  {
    icon: LayoutGrid,
    title: "Table & Floor Plans",
    description:
      "Interactive floor plan editor. Drag-and-drop table management with real-time occupancy tracking.",
  },
];

export default function FeaturesSection() {
  return (
    <section className="py-24 sm:py-32 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section heading */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-sm font-semibold tracking-widest uppercase bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent">
              Features
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Everything you need to run your restaurant
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              VYNTEX combines powerful POS features with an intuitive interface,
              so your team can focus on what matters — great service.
            </p>
          </motion.div>
        </div>

        {/* Feature cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="group relative rounded-xl border border-border bg-card p-6 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-[#0066FF]/10 to-[#44CC00]/10 group-hover:from-[#0066FF]/20 group-hover:to-[#44CC00]/20 transition-colors">
                  <feature.icon className="size-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {feature.title}
                </h3>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
