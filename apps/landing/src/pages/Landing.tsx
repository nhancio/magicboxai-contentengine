import { Navigation } from "@/components/landing/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { IntegrationsSection } from "@/components/landing/integrations-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { UseCasesSection } from "@/components/landing/use-cases-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { FaqSection } from "@/components/landing/faq-section";
import { CtaSection } from "@/components/landing/cta-section";
import { FooterSection } from "@/components/landing/footer-section";

/**
 * Conversion-focused composition:
 * phone hero → supported channels → workflow → feature stories →
 * use cases → pricing → FAQ → CTA.
 * Spotlight/Security removed as redundant with phone-led sections.
 */
export default function Landing() {
  return (
    <main className="relative overflow-x-hidden bg-background text-foreground">
      <Navigation />
      <HeroSection />
      <IntegrationsSection />
      <HowItWorksSection />
      <FeaturesSection />
      <UseCasesSection />
      <PricingSection />
      <FaqSection />
      <CtaSection />
      <FooterSection />
    </main>
  );
}
