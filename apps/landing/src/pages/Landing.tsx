import { Navigation } from "@/components/landing/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { AboutMagicBoxSection } from "@/components/landing/about-magicbox-section";
import { IntegrationsSection } from "@/components/landing/integrations-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { UseCasesSection } from "@/components/landing/use-cases-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { FaqSection } from "@/components/landing/faq-section";
import { CtaSection } from "@/components/landing/cta-section";
import { FooterSection } from "@/components/landing/footer-section";

/**
 * Conversion-focused composition + Google OAuth verification homepage content:
 * hero (purpose + MagicBox name) → about MagicBox (Google data use) →
 * channels → workflow → features → use cases → pricing → FAQ → CTA.
 */
export default function Landing() {
  return (
    <main className="relative bg-background text-foreground">
      <Navigation />
      <HeroSection />
      <AboutMagicBoxSection />
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
