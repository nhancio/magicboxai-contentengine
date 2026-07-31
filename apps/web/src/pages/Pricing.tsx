import { useState, useEffect, useRef } from "react";
import { useAuth } from "@shared/lib/auth";
import { getUserSubscription, type SubscriptionRecord } from "@shared/lib/firestore";
import { createDodoCheckout, createDodoPortal } from "@shared/lib/suite";
import { Button } from "@shared/components/ui/button";
import { toast } from "sonner";
import { cn } from "@shared/lib/utils";
import { captureEvent } from "@shared/lib/analytics";
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
  CalendarClock,
} from "lucide-react";

/** Google Calendar appointment scheduling page — opens the booking UI. */
const BOOK_APPOINTMENT_URL = "https://calendar.app.google/TH9bgDRMEdDpLvD68";

type PlanId = "free" | "pro" | "max" | "custom";

interface PlanConfig {
  id: PlanId;
  name: string;
  description: string;
  monthly: number | null; // USD dollars; null = custom
  annual: number | null; // USD dollars/mo billed annually
  annualTotal?: number;
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
    annualTotal: 276,
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
    description: "For high-volume teams",
    monthly: 149,
    annual: 118,
    annualTotal: 1416,
    features: [
      "300 scheduled posts/month",
      "Everything in Pro",
      "Higher-volume scheduling",
      "More monthly publishing capacity",
      "Email support",
    ],
    icon: Crown,
  },
  {
    id: "custom",
    name: "Custom",
    description: "For teams with needs beyond the current plans",
    monthly: null,
    annual: null,
    features: [
      "Discuss current product fit",
      "Plan a supported workflow",
      "Request launch support",
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
  const [requestedPlan, setRequestedPlan] = useState<"pro" | "max" | null>(null);
  const hasTrackedView = useRef(false);

  useEffect(() => {
    if (hasTrackedView.current) return;
    hasTrackedView.current = true;
    captureEvent("pricing_viewed", { surface: "app" });
  }, []);

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
    const plan = params.get("plan");
    if (plan === "pro" || plan === "max") setRequestedPlan(plan);
    if (checkout === "returned") {
      captureEvent("checkout_returned", { source: "dodo" });
      toast.info("Checkout returned. Your plan will appear after payment is verified.");
      if (user) getUserSubscription(user.uid).then(setSubscriptionState).catch(() => {});
    }
    if (params.get("billing") === "monthly") setIsAnnual(false);
    if (checkout) window.history.replaceState({}, "", window.location.pathname);
  }, [user]);

  const openBooking = (source: string) => {
    captureEvent("book_appointment_clicked", { source });
    window.open(BOOK_APPOINTMENT_URL, "_blank", "noopener,noreferrer");
  };

  const handleSubscribe = async (plan: PlanConfig) => {
    if (plan.id === "free") return;
    if (plan.custom) {
      openBooking("custom_plan");
      return;
    }
    if (!user) {
      toast.error("Please sign in first");
      return;
    }
    captureEvent("checkout_started", {
      plan: plan.id,
      billing: isAnnual ? "annual" : "monthly",
    });
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
                  "group relative bg-background p-8 flex flex-col border-2 border-transparent transition-all duration-300",
                  "hover:border-brand hover:lg:-my-4 hover:lg:py-12",
                  requestedPlan === plan.id && "ring-2 ring-brand ring-offset-2 ring-offset-background"
                )}
              >
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-lg flex items-center justify-center bg-foreground text-background transition-colors duration-300 group-hover:bg-brand group-hover:text-brand-foreground">
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
                  {isAnnual && plan.annualTotal && (
                    <p className="mt-2 text-xs text-muted-foreground">${plan.annualTotal} billed annually</p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 mt-0.5 shrink-0 text-foreground transition-colors duration-300 group-hover:text-brand" />
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
                    variant="outline"
                    className="w-full h-11 gap-2 transition-colors duration-300 group-hover:bg-brand group-hover:text-brand-foreground group-hover:border-brand group-hover:hover:bg-brand/90"
                  >
                    {processing === plan.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        {plan.custom ? "Book an appointment" : requestedPlan === plan.id ? `Continue with ${plan.name}` : "Get started"}
                        {plan.custom ? <CalendarClock className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                      </>
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Agency — done-for-you managed service */}
        <div className="rounded-2xl border border-brand/25 bg-brand/[0.06] p-6 sm:p-8 md:flex md:items-center md:justify-between md:gap-8">
          <div className="max-w-2xl">
            <span className="eyebrow">
              <Sparkles className="w-3.5 h-3.5" />
              Managed service
            </span>
            <h2 className="mt-2 font-display text-2xl text-foreground sm:text-3xl">
              Want more scale? We'll run it for you.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We run an agency service where we manage everything for you — buying accounts,
              warming, and done-for-you posting.
            </p>
          </div>
          <Button
            onClick={() => openBooking("agency_managed_service")}
            className="mt-5 h-11 shrink-0 gap-2 md:mt-0"
          >
            <CalendarClock className="w-4 h-4" />
            Book an appointment
          </Button>
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
