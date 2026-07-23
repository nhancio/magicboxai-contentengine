import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { CALENDLY_URL, appLoginUrl } from "@/lib/config";
import { captureEvent } from "@shared/lib/analytics";

type Plan = {
  name: string;
  description: string;
  price: { monthly: number | null; annual: number | null; annualTotal?: number };
  features: string[];
  cta: string;
  href: string;
  popular?: boolean;
  custom?: boolean;
  /** Paid plans always enter the authenticated checkout flow. */
  planId?: "pro" | "max";
};

const plans: Plan[] = [
  {
    name: "Free",
    description: "Start creating, no card required",
    price: { monthly: 0, annual: 0 },
    features: [
      "Create and save content drafts",
      "Explore brand and content tools",
      "Preview the automation workflow",
      "Publishing requires a paid plan",
    ],
    cta: "Start free",
    href: appLoginUrl(),
  },
  {
    name: "Pro",
    description: "Great for solo founders testing the waters",
    price: { monthly: 29, annual: 23, annualTotal: 276 },
    features: [
      "60 scheduled posts/month",
      "Brand-aware captions and images",
      "Instagram, LinkedIn, and YouTube",
      "Approval and recurring schedules",
      "Email support",
    ],
    cta: "Get started",
    href: appLoginUrl("/pricing"),
    planId: "pro",
    popular: true,
  },
  {
    name: "Max",
    description: "For high-volume teams",
    price: { monthly: 149, annual: 118, annualTotal: 1416 },
    features: [
      "300 scheduled posts/month",
      "Everything in Pro",
      "Higher-volume scheduling",
      "More monthly publishing capacity",
      "Email support",
    ],
    cta: "Get started",
    href: appLoginUrl("/pricing"),
    planId: "max",
  },
  {
    name: "Custom",
    description: "For teams with needs beyond the current plans",
    price: { monthly: null, annual: null },
    features: [
      "Discuss current product fit",
      "Plan a supported workflow",
      "Request launch support",
    ],
    cta: "Contact support",
    href: CALENDLY_URL,
    custom: true,
  },
];

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <section id="pricing" className="relative py-32 lg:py-40 border-t border-foreground/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="max-w-3xl mb-16">
          <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase block mb-6">Pricing</span>
          <h2 className="font-display text-5xl md:text-6xl lg:text-7xl tracking-tight text-foreground mb-6">
            Simple, transparent
            <br />
            <span className="text-stroke">pricing</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl">
            Start free and scale as you grow. No hidden fees, no per-post surprises.
          </p>
        </div>

        <div className="flex items-center gap-4 mb-14">
          <span className={`text-sm transition-colors ${!isAnnual ? "text-foreground" : "text-muted-foreground"}`}>Monthly</span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            aria-label={`Switch to ${isAnnual ? "monthly" : "annual"} billing`}
            className="relative w-14 h-7 bg-foreground/10 rounded-full p-1 transition-colors hover:bg-foreground/20"
          >
            <div className={`w-5 h-5 bg-brand rounded-full transition-transform duration-300 ${isAnnual ? "translate-x-7" : "translate-x-0"}`} />
          </button>
          <span className={`text-sm transition-colors ${isAnnual ? "text-foreground" : "text-muted-foreground"}`}>Annual</span>
          {isAnnual && <span className="ml-2 px-2 py-1 bg-brand text-brand-foreground text-xs font-mono">Save 21%</span>}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-foreground/10">
          {plans.map((plan, idx) => (
            <div key={plan.name} className={`relative p-8 bg-background flex flex-col ${plan.popular ? "lg:-my-4 lg:py-12 border-2 border-brand" : ""}`}>
              {plan.popular && (
                <span className="absolute -top-3 left-8 px-3 py-1 bg-brand text-brand-foreground text-xs font-mono uppercase tracking-widest">Most popular</span>
              )}
              <div className="mb-6">
                <span className="font-mono text-xs text-muted-foreground">{String(idx + 1).padStart(2, "0")}</span>
                <h3 className="font-display text-2xl text-foreground mt-2">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
              </div>
              <div className="mb-6 pb-6 border-b border-foreground/10">
                {plan.price.monthly !== null ? (
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-4xl lg:text-5xl text-foreground">${isAnnual ? plan.price.annual : plan.price.monthly}</span>
                    <span className="text-muted-foreground text-sm">/mo</span>
                  </div>
                ) : (
                  <span className="font-display text-3xl text-foreground">Custom</span>
                )}
                {isAnnual && plan.price.annualTotal && (
                  <p className="mt-2 text-xs text-muted-foreground">${plan.price.annualTotal} billed annually</p>
                )}
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className={`w-4 h-4 mt-0.5 shrink-0 ${plan.popular ? "text-brand" : "text-foreground"}`} />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              <a
                href={
                  plan.planId
                    ? appLoginUrl(`/pricing?plan=${plan.planId}&billing=${isAnnual ? "annual" : "monthly"}`)
                    : plan.href
                }
                {...(plan.custom ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                onClick={() => captureEvent("pricing_cta_clicked", { plan: plan.name.toLowerCase(), billing: isAnnual ? "annual" : "monthly" })}
                className={`w-full py-4 flex items-center justify-center gap-2 text-sm font-medium transition-all group ${
                  plan.popular
                    ? "bg-brand text-brand-foreground hover:bg-brand/90"
                    : "border border-foreground/20 text-foreground hover:border-foreground hover:bg-foreground/5"
                }`}
              >
                {plan.cta}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
