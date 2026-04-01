import { motion } from "motion/react";

type PageHeaderProps = {
  badge?: string;
  title: string;
  subtitle?: string;
};

export default function PageHeader({ badge, title, subtitle }: PageHeaderProps) {
  return (
    <section className="pt-32 pb-16 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {badge && (
            <span className="text-sm font-semibold tracking-widest uppercase bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent">
              {badge}
            </span>
          )}
          <h1 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground text-balance">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
              {subtitle}
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
