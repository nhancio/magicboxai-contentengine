import { Navigation } from "@/components/landing/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { AboutMagicBoxSection } from "@/components/landing/about-magicbox-section";
import { IntegrationsSection } from "@/components/landing/integrations-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { ReelsShowcaseSection } from "@/components/landing/reels-showcase-section";
import { UseCasesSection } from "@/components/landing/use-cases-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { FaqSection } from "@/components/landing/faq-section";
import { CtaSection } from "@/components/landing/cta-section";
import { FooterSection } from "@/components/landing/footer-section";

/**
 * Conversion-focused composition: purpose → integrations → workflow → features →
 * reel formats → use cases → pricing → FAQ → CTA. Legal and verification details live in the footer.
 */
export default function Landing() {
  return (
    <div className="relative bg-background text-foreground">
      <Navigation />
      <main id="main-content">
        <HeroSection />
        <AboutMagicBoxSection />
        <IntegrationsSection />
        <HowItWorksSection />
        <FeaturesSection />
        <ReelsShowcaseSection />
        <UseCasesSection />
        <PricingSection />
        <FaqSection />
        <CtaSection />
      </main>
      <FooterSection />
    </div>
  );
}
