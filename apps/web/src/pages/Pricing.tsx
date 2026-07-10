import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@shared/lib/auth";
import {
  getUserSubscription,
  type SubscriptionRecord,
} from "@shared/lib/firestore";
import { functions } from "@shared/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { Button } from "@shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/card";
import { Badge } from "@shared/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@shared/lib/utils";
import {
  Check,
  Crown,
  Sparkles,
  Video,
  Zap,
  Camera,
  Loader2,
  ArrowRight,
  Shield,
} from "lucide-react";

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id?: string;
  handler: (response: RazorpayResponse) => void;
  prefill?: { name?: string; email?: string };
  theme?: { color: string };
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_subscription_id?: string;
  razorpay_signature?: string;
}

const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID || "";

interface PlanConfig {
  id: "free" | "starter" | "pro";
  name: string;
  price: number;
  priceLabel: string;
  period: string;
  videoLimit: number;
  features: string[];
  gradient: string;
  icon: React.ElementType;
  popular?: boolean;
}

const PLANS: PlanConfig[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    priceLabel: "0",
    period: "",
    videoLimit: 0,
    features: [
      "Create unlimited avatars",
      "Browse all templates",
      "Preview video scripts",
      "0 video generations",
    ],
    gradient: "from-zinc-500 to-zinc-600",
    icon: Camera,
  },
  {
    id: "starter",
    name: "Starter",
    price: 100000, // in paise (INR 1000)
    priceLabel: "1,000",
    period: "/month",
    videoLimit: 50,
    features: [
      "Everything in Free",
      "50 video generations/month",
      "AI product photo analysis",
      "All viral templates",
      "Script + hooks generation",
      "Priority support",
    ],
    gradient: "from-purple-500 to-indigo-600",
    icon: Sparkles,
    popular: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: 500000, // in paise (INR 5000)
    priceLabel: "5,000",
    period: "/month",
    videoLimit: 1000,
    features: [
      "Everything in Starter",
      "1,000 video generations/month",
      "AI product photo analysis",
      "All viral templates",
      "Script + hooks generation",
      "Dedicated support",
      "Early access to new features",
    ],
    gradient: "from-amber-500 to-orange-600",
    icon: Crown,
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subscription, setSubscriptionState] = useState<SubscriptionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserSubscription(user.uid)
      .then(setSubscriptionState)
      .catch(() => setSubscriptionState({ plan: "free", videosUsed: 0, videosLimit: 0 }))
      .finally(() => setLoading(false));
  }, [user]);

  // Load Razorpay script
  useEffect(() => {
    if (document.getElementById("razorpay-script")) return;
    const script = document.createElement("script");
    script.id = "razorpay-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const handleSubscribe = async (plan: PlanConfig) => {
    if (!user) {
      toast.error("Please sign in first");
      return;
    }

    if (plan.id === "free") return;
    const paidPlanId = plan.id as "starter" | "pro";

    if (!RAZORPAY_KEY) {
      toast.error("Payment system not configured. Please contact support.");
      return;
    }

    if (!window.Razorpay) {
      toast.error("Payment system is loading. Please try again.");
      return;
    }

    setProcessing(plan.id);

    try {
      if (!functions) {
        throw new Error("Firebase functions not initialized");
      }

      const createOrderFn = httpsCallable<
        { planId: "starter" | "pro" },
        { orderId: string; amount: number; currency: string; keyId: string }
      >(functions, "createRazorpayOrder");

      const verifyPaymentFn = httpsCallable<
        {
          planId: "starter" | "pro";
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        },
        { success: boolean; subscription: SubscriptionRecord }
      >(functions, "verifyRazorpayPayment");

      const order = await createOrderFn({ planId: paidPlanId });

      const options: RazorpayOptions = {
        key: order.data.keyId || RAZORPAY_KEY,
        amount: order.data.amount,
        currency: order.data.currency,
        name: "MagicBox AI",
        description: `${plan.name} Plan - ${plan.videoLimit} video generations/month`,
        order_id: order.data.orderId,
        handler: async (response: RazorpayResponse) => {
          try {
            if (!response.razorpay_signature) {
              throw new Error("Missing payment signature from Razorpay");
            }

            const verification = await verifyPaymentFn({
              planId: paidPlanId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setSubscriptionState(verification.data.subscription);

            toast.success(
              `Subscribed to ${plan.name} plan! You have ${plan.videoLimit} video generations.`
            );
            navigate("/create-video");
          } catch {
            toast.error("Payment succeeded but activation failed. Contact support with your payment ID.");
          }
          setProcessing(null);
        },
        prefill: {
          name: user.displayName || undefined,
          email: user.email || undefined,
        },
        theme: { color: "#7c3aed" },
        modal: {
          ondismiss: () => setProcessing(null),
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      toast.error("Failed to initialize payment");
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">
            <Zap className="w-3 h-3 mr-1" />
            Simple Pricing
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Choose Your Plan
          </h1>
          <p className="text-white/50 text-sm max-w-lg mx-auto">
            Avatar creation is always free. Choose a plan to start generating
            AI-powered product videos with your avatar.
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isCurrentPlan = subscription?.plan === plan.id;
            return (
              <Card
                key={plan.id}
                className={cn(
                  "rounded-2xl transition-all duration-300 relative overflow-hidden",
                  plan.popular
                    ? "border-purple-500/40 bg-purple-500/[0.03] shadow-lg shadow-purple-500/10"
                    : "bg-white/[0.03] border-white/[0.06]",
                  isCurrentPlan && "ring-2 ring-emerald-500/30 border-emerald-500/30"
                )}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-600" />
                )}
                <CardHeader className="pb-4 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center",
                        `bg-gradient-to-br ${plan.gradient}`
                      )}
                    >
                      <plan.icon className="w-5 h-5 text-white" />
                    </div>
                    {plan.popular && (
                      <Badge className="bg-purple-500 text-white border-0 text-xs">
                        Most Popular
                      </Badge>
                    )}
                    {isCurrentPlan && (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                        Current Plan
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-white text-xl">{plan.name}</CardTitle>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl font-bold text-white">
                      {plan.price === 0 ? "Free" : `\u20B9${plan.priceLabel}`}
                    </span>
                    {plan.period && (
                      <span className="text-sm text-white/40">{plan.period}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pb-6">
                  {/* Video limit highlight */}
                  <div
                    className={cn(
                      "rounded-xl px-4 py-3 flex items-center gap-3",
                      plan.id === "free"
                        ? "bg-white/[0.04]"
                        : `bg-gradient-to-r ${plan.gradient} bg-opacity-10`
                    )}
                    style={
                      plan.id !== "free"
                        ? { background: `linear-gradient(135deg, rgba(168,85,247,0.1), rgba(99,102,241,0.1))` }
                        : undefined
                    }
                  >
                    <Video className="w-5 h-5 text-purple-400 shrink-0" />
                    <span className="text-sm font-medium text-white">
                      {plan.videoLimit === 0
                        ? "No video generations"
                        : `${plan.videoLimit} videos/month`}
                    </span>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        <span className="text-sm text-white/60">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  {isCurrentPlan ? (
                    <Button
                      disabled
                      className="w-full h-11 bg-white/5 text-white/40 border border-white/10"
                    >
                      Current Plan
                    </Button>
                  ) : plan.id === "free" ? (
                    <Button
                      variant="outline"
                      className="w-full h-11 border-white/10 text-white/60 hover:text-white hover:bg-white/5"
                      disabled
                    >
                      Default Plan
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleSubscribe(plan)}
                      disabled={processing !== null}
                      className={cn(
                        "w-full h-11 text-white gap-2",
                        plan.popular
                          ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25"
                          : "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500"
                      )}
                    >
                      {processing === plan.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          Subscribe Now
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-6 pt-4">
          <div className="flex items-center gap-2 text-white/30 text-xs">
            <Shield className="w-4 h-4" />
            Secure payments via Razorpay
          </div>
          <div className="flex items-center gap-2 text-white/30 text-xs">
            <Camera className="w-4 h-4" />
            Avatar creation always free
          </div>
          <div className="flex items-center gap-2 text-white/30 text-xs">
            <Zap className="w-4 h-4" />
            Cancel anytime
          </div>
        </div>
      </div>
    </div>
  );
}
