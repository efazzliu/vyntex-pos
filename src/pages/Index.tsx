import HeroSection from "./_components/hero-section.tsx";
import FeaturesSection from "./_components/features-section.tsx";
import StatsSection from "./_components/stats-section.tsx";
import FaqSection from "./_components/faq-section.tsx";
import CTASection from "./_components/cta-section.tsx";

export default function Index() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <StatsSection />
      <FaqSection />
      <CTASection />
    </>
  );
}
