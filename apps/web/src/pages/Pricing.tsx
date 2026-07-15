import { useState, useEffect } from "react";
import { useAuth } from "@shared/lib/auth";
import { getUserSubscription, type SubscriptionRecord } from "@shared/lib/firestore";
import { createDodoCheckout, createDodoPortal } from "@shared/lib/suite";
import { Button } from "@shared/components/ui/button";
import { toast } from "sonner";
import { cn } from "@shared/lib/utils";
import {
  Check,
  Crown,
  Sparkles,
  Camera,
  Building2,
  Loader2,
  ArrowRight,
  Shield,
  Zap,
} from "lucide-react";

const CALENDLY_URL = "mailto:support@magicboxai.in?subject=MagicBox%20sales";

type PlanId = "free" | "pro" | "max" | "custom";

interface PlanConfig {
  id: PlanId;
  name: string;
  description: string;
  monthly: number | null; // USD dollars; null = custom
  annual: number | null; // USD dollars/mo billed annually
  features: string[];
  icon: React.ElementType;
  popular?: boolean;
  custom?: boolean;
}

// Mirrors the landing page pricing exactly.
const PLANS: PlanConfig[] = [
  {
    id: "free",
    name: "Free",
    description: "Start creating, no card required",
    monthly: 0,
    annual: 0,
    features: [
      "Create and save content drafts",
      "Explore brand and content tools",
      "Preview the automation workflow",
      "Publishing requires a paid plan",
    ],
    icon: Camera,
  },
  {
    id: "pro",
    name: "Pro",
    description: "Great for solo founders testing the waters",
    monthly: 29,
    annual: 23,
    features: [
      "60 scheduled posts/month",
      "Brand-aware captions and images",
      "Instagram, LinkedIn, and YouTube",
      "Approval and recurring schedules",
      "Email support",
    ],
    icon: Sparkles,
    popular: true,
  },
  {
    id: "max",
    name: "Max",
    description: "For power users and agencies",
    monthly: 149,
    annual: 118,
    features: [
      "300 scheduled posts/month",
      "Everything in Pro",
      "Higher-volume automation",
      "Multiple connected channels",
      "Priority support",
    ],
    icon: Crown,
  },
  {
    id: "custom",
    name: "Custom",
    description: "For larger organizations",
    monthly: null,
    annual: null,
    features: [
      "Custom features",
      "Custom integrations",
      "Custom reporting",
      "SLAs",
      "Priority support",
    ],
    icon: Building2,
    custom: true,
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const [subscription, setSubscriptionState] = useState<SubscriptionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(true);

  useEffect(() => {
    if (!user) return;
    getUserSubscription(user.uid)
      .then(setSubscriptionState)
      .catch(() => setSubscriptionState({ plan: "free", videosUsed: 0, videosLimit: 0 }))
      .finally(() => setLoading(false));
  }, [user]);

  // A return URL is not proof of payment; only the signed webhook activates a plan.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    if (checkout === "returned") {
      toast.info("Checkout returned. Your plan will appear after payment is verified.");
      if (user) getUserSubscription(user.uid).then(setSubscriptionState).catch(() => {});
    }
    if (params.get("billing") === "monthly") setIsAnnual(false);
    if (checkout) window.history.replaceState({}, "", window.location.pathname);
  }, [user]);

  const handleSubscribe = async (plan: PlanConfig) => {
    if (plan.id === "free") return;
    if (plan.custom) {
      window.open(CALENDLY_URL, "_blank", "noopener,noreferrer");
      return;
    }
    if (!user) {
      toast.error("Please sign in first");
      return;
    }
    setProcessing(plan.id);
    try {
      const { url } = await createDodoCheckout({
        planId: plan.id as "pro" | "max",
        billing: isAnnual ? "annual" : "monthly",
      });
      window.location.href = url; // redirect to Dodo hosted checkout
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(detail ? `Could not start checkout: ${detail}` : "Could not start checkout");
      setProcessing(null);
    }
  };

  const handleManageBilling = async () => {
    setProcessing("portal");
    try {
      const { url } = await createDodoPortal({});
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open billing management");
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header */}
        <div className="text-center space-y-4">
          <span className="eyebrow justify-center">
            <Zap className="w-3.5 h-3.5" />
            Simple Pricing
          </span>
          <h1 className="text-4xl md:text-5xl font-display text-foreground tracking-tight">
            Choose your plan
          </h1>
          <p className="text-muted-foreground text-base max-w-lg mx-auto">
            Start free and scale as you grow. No hidden fees, no per-post surprises.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-4">
          <span className={cn("text-sm", !isAnnual ? "text-foreground" : "text-muted-foreground")}>
            Monthly
          </span>
          <button
            onClick={() => setIsAnnual((v) => !v)}
            className="relative w-14 h-7 bg-foreground/10 rounded-full p-1 transition-colors hover:bg-foreground/20"
            aria-label="Toggle annual billing"
          >
            <div
              className={cn(
                "w-5 h-5 bg-brand rounded-full transition-transform duration-300",
                isAnnual ? "translate-x-7" : "translate-x-0"
              )}
            />
          </button>
          <span className={cn("text-sm", isAnnual ? "text-foreground" : "text-muted-foreground")}>
            Annual
          </span>
          {isAnnual && (
            <span className="ml-1 px-2 py-1 bg-brand text-brand-foreground text-xs font-mono">
              Save 21%
            </span>
          )}
        </div>

        {/* Plans grid — hairline-separated columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border">
          {PLANS.map((plan, idx) => {
            const isCurrentPlan = subscription?.plan === plan.id;
            const Icon = plan.icon;
            const price = isAnnual ? plan.annual : plan.monthly;
            return (
              <div
                key={plan.id}
                className={cn(
                  "relative bg-background p-8 flex flex-col",
                  plan.popular && "lg:-my-4 lg:py-12 border-2 border-brand"
                )}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-8 px-3 py-1 bg-brand text-brand-foreground text-xs font-mono uppercase tracking-widest">
                    Most popular
                  </span>
                )}

                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={cn(
                        "w-11 h-11 rounded-lg flex items-center justify-center",
                        plan.popular ? "bg-brand text-brand-foreground" : "bg-foreground text-background"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    {isCurrentPlan && (
                      <span className="rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 px-2.5 py-1 text-xs font-medium">
                        Current Plan
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-display text-3xl text-foreground mt-1">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                </div>

                <div className="mb-6 pb-6 border-b border-border">
                  {price === null ? (
                    <span className="font-display text-4xl text-foreground">Custom</span>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-5xl text-foreground">${price}</span>
                      {price > 0 && <span className="text-sm text-muted-foreground">/mo</span>}
                    </div>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check
                        className={cn(
                          "w-4 h-4 mt-0.5 shrink-0",
                          plan.popular ? "text-brand" : "text-foreground"
                        )}
                      />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {plan.id === "free" ? (
                  <Button variant="outline" className="w-full h-11" disabled>
                    {isCurrentPlan ? "Current Plan" : "Included free"}
                  </Button>
                ) : isCurrentPlan && subscription?.provider === "dodo" ? (
                  <Button
                    onClick={handleManageBilling}
                    disabled={processing !== null}
                    variant="outline"
                    className="w-full h-11"
                  >
                    {processing === "portal" ? "Opening billing…" : "Manage billing"}
                  </Button>
                ) : isCurrentPlan ? (
                  <Button disabled variant="outline" className="w-full h-11">
                    Current plan
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleSubscribe(plan)}
                    disabled={processing !== null}
                    variant={plan.popular ? "default" : "outline"}
                    className="w-full h-11 gap-2"
                  >
                    {processing === plan.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        {plan.custom ? "Contact us" : "Get started"}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Trust */}
        <div className="flex flex-wrap items-center justify-center gap-6">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Shield className="w-4 h-4" />
            Secure checkout via Dodo Payments
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Camera className="w-4 h-4" />
            Cancel anytime
          </div>
        </div>
      </div>
    </div>
  );
}
