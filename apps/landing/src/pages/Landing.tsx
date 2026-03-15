import { useState, useEffect, useRef } from "react";
import { motion, useInView, useAnimation } from "framer-motion";
import {
  Wand2,
  Palette,
  Megaphone,
  Share2,
  Calendar,
  BarChart3,
  ArrowRight,
  Play,
  Check,
  Menu,
  X,
  Sparkles,
  Zap,
  Star,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@shared/components/ui/button";
import { Badge } from "@shared/components/ui/badge";

const APP_URL = "https://app.magicboxai.in";
const LOGIN_URL = "https://app.magicboxai.in/login";

/* ───────────────────────── Data ───────────────────────── */

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "About", href: "#how-it-works" },
];

const stats = [
  { value: 10000, suffix: "+", label: "Creators", prefix: "" },
  { value: 500, suffix: "K+", label: "Avatars Generated", prefix: "" },
  { value: 50, suffix: "M+", label: "Content Pieces", prefix: "" },
  { value: 99.9, suffix: "%", label: "Uptime", prefix: "" },
];

const features = [
  {
    icon: Wand2,
    title: "AI Avatar Builder",
    description:
      "Generate photorealistic avatars from simple text prompts. Choose styles, expressions, and outfits with precision control.",
    gradient: "from-purple-500 to-violet-600",
  },
  {
    icon: Palette,
    title: "Content Studio",
    description:
      "Create scroll-stopping social media posts, stories, and reels with AI-powered design tools and templates.",
    gradient: "from-indigo-500 to-blue-600",
  },
  {
    icon: Megaphone,
    title: "Ad Generator",
    description:
      "Produce high-converting ad creatives in seconds. A/B test variations and optimize for maximum engagement.",
    gradient: "from-pink-500 to-rose-600",
  },
  {
    icon: Share2,
    title: "Multi-Platform Publishing",
    description:
      "Publish directly to Instagram, TikTok, YouTube, LinkedIn, and Twitter from a single dashboard.",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    icon: Calendar,
    title: "Smart Scheduling",
    description:
      "AI-optimized scheduling picks the perfect time to post for maximum reach and engagement across all platforms.",
    gradient: "from-amber-500 to-orange-600",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description:
      "Track performance across every channel with real-time analytics, audience insights, and growth recommendations.",
    gradient: "from-cyan-500 to-sky-600",
  },
];

const showcaseItems = [
  { label: "Fashion Influencer", gradient: "from-pink-500 via-rose-500 to-red-500" },
  { label: "Tech Reviewer", gradient: "from-blue-500 via-indigo-500 to-violet-500" },
  { label: "Fitness Coach", gradient: "from-emerald-500 via-green-500 to-teal-500" },
  { label: "Travel Blogger", gradient: "from-amber-500 via-orange-500 to-red-500" },
  { label: "Food Creator", gradient: "from-yellow-500 via-amber-500 to-orange-500" },
  { label: "Gaming Streamer", gradient: "from-purple-500 via-violet-500 to-indigo-500" },
  { label: "Beauty Expert", gradient: "from-pink-400 via-fuchsia-500 to-purple-500" },
  { label: "Music Artist", gradient: "from-cyan-500 via-blue-500 to-indigo-500" },
];

const steps = [
  {
    step: "01",
    title: "Sign Up",
    description: "Create your free account in seconds. No credit card required to get started.",
    gradient: "from-purple-500 to-indigo-500",
  },
  {
    step: "02",
    title: "Create Your Avatar",
    description:
      "Use our AI builder to craft your perfect digital avatar. Customize every detail to match your brand.",
    gradient: "from-indigo-500 to-blue-500",
  },
  {
    step: "03",
    title: "Publish & Grow",
    description:
      "Generate content, schedule posts, and watch your audience grow with AI-powered optimization.",
    gradient: "from-blue-500 to-violet-500",
  },
];

const pricingTiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for getting started",
    features: [
      "5 avatars per month",
      "Basic content templates",
      "1 social platform",
      "Community support",
      "720p exports",
    ],
    cta: "Get Started Free",
    popular: false,
    gradient: "from-zinc-600 to-zinc-700",
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For serious creators",
    features: [
      "Unlimited avatars",
      "All content templates",
      "All social platforms",
      "Priority support",
      "4K exports",
      "Smart scheduling",
      "Advanced analytics",
      "Custom brand kit",
    ],
    cta: "Start Pro Trial",
    popular: true,
    gradient: "from-purple-600 to-indigo-600",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For teams & agencies",
    features: [
      "Everything in Pro",
      "API access",
      "Dedicated account manager",
      "Custom AI model training",
      "SSO & team management",
      "SLA guarantee",
      "White-label options",
      "Onboarding & training",
    ],
    cta: "Contact Sales",
    popular: false,
    gradient: "from-indigo-600 to-blue-600",
  },
];

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Fashion Influencer",
    initials: "SC",
    quote:
      "MagicBox AI completely transformed my content workflow. I went from spending 8 hours per day on content to just 2 hours, while actually increasing my engagement by 3x.",
    gradient: "from-pink-500 to-rose-500",
  },
  {
    name: "Marcus Rodriguez",
    role: "Marketing Agency CEO",
    initials: "MR",
    quote:
      "We use MagicBox AI for all our client campaigns. The AI avatar generation is insanely good, and the multi-platform publishing saves us countless hours every week.",
    gradient: "from-purple-500 to-indigo-500",
  },
  {
    name: "Priya Patel",
    role: "Tech Content Creator",
    initials: "PP",
    quote:
      "The analytics dashboard alone is worth the subscription. But combined with the AI content generation and smart scheduling, it's an absolute game-changer for any creator.",
    gradient: "from-indigo-500 to-blue-500",
  },
];

const footerLinks = {
  Product: ["Features", "Pricing", "API", "Integrations", "Changelog"],
  Company: ["About", "Blog", "Careers", "Press", "Partners"],
  Legal: ["Privacy Policy", "Terms of Service", "Cookie Policy", "GDPR"],
  Social: ["Twitter", "Instagram", "LinkedIn", "YouTube", "Discord"],
};

/* ───────────────────────── Helpers ───────────────────────── */

function AnimatedSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.4, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function AnimatedCounter({ value, suffix, duration = 2 }: { value: number; suffix: string; duration?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const end = value;
    const stepTime = Math.max(duration * 1000 / end, 10);
    const increment = Math.max(Math.ceil(end / (duration * 100)), 1);

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [isInView, value, duration]);

  return (
    <span ref={ref}>
      {value === 99.9 ? (isInView ? "99.9" : "0") : count.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ───────────────────────── Navbar ───────────────────────── */

function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-zinc-950/80 backdrop-blur-xl border-b border-white/[0.06]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-shadow">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-display font-bold text-white">
              MagicBox <span className="gradient-text">AI</span>
            </span>
          </a>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-white/60 hover:text-white transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <a href={LOGIN_URL}>
              <Button variant="ghost" size="sm">
                Login
              </Button>
            </a>
            <a href={APP_URL}>
              <button className="btn-gradient text-sm h-10 px-6">
                Get Started
                <ArrowRight className="w-4 h-4 ml-1 inline" />
              </button>
            </a>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-white/70 hover:text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden bg-zinc-950/95 backdrop-blur-xl border-b border-white/[0.06]"
        >
          <div className="px-4 py-6 space-y-4">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="block text-base text-white/70 hover:text-white transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <a href={LOGIN_URL} className="block">
                <Button variant="outline" className="w-full">
                  Login
                </Button>
              </a>
              <a href={APP_URL} className="block">
                <button className="btn-gradient w-full h-11">
                  Get Started <ArrowRight className="w-4 h-4 ml-1 inline" />
                </button>
              </a>
            </div>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background orbs */}
      <div className="glow-orb w-[600px] h-[600px] bg-purple-600 top-[-200px] left-[-200px] animate-pulse-glow" />
      <div className="glow-orb w-[500px] h-[500px] bg-indigo-600 bottom-[-150px] right-[-150px] animate-pulse-glow" style={{ animationDelay: "1.5s" }} />
      <div className="glow-orb w-[300px] h-[300px] bg-violet-600 top-[30%] right-[10%] animate-pulse-glow" style={{ animationDelay: "0.8s" }} />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <Badge className="mb-6 inline-flex items-center gap-1.5 px-4 py-1.5 text-sm">
            <Zap className="w-3.5 h-3.5" />
            Now with GPT-4o Vision & FLUX Models
          </Badge>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
          className="font-display font-extrabold text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight leading-[1.05] mb-6"
        >
          Create Stunning{" "}
          <span className="gradient-text">AI Avatars</span>
          <br />
          & <span className="gradient-text-alt">Social Content</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="max-w-2xl mx-auto text-lg md:text-xl text-white/50 leading-relaxed mb-10"
        >
          The all-in-one AI platform for creators, influencers, and brands. Generate photorealistic
          avatars, craft viral content, and grow your audience across every platform.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease: "easeOut" }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a href={APP_URL}>
            <button className="btn-gradient h-13 px-10 text-base gap-2">
              Get Started Free
              <ArrowRight className="w-5 h-5 inline" />
            </button>
          </a>
          <button className="btn-outline-glow h-13 px-10 text-base gap-2">
            <Play className="w-5 h-5" />
            Watch Demo
          </button>
        </motion.div>

        {/* Floating cards */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.7, ease: "easeOut" }}
          className="mt-20 relative max-w-5xl mx-auto"
        >
          <div className="relative flex items-center justify-center gap-4 md:gap-6">
            {/* Left card */}
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="hidden sm:block w-48 md:w-56 h-64 md:h-72 rounded-2xl bg-gradient-to-br from-purple-600/30 to-indigo-600/30 border border-white/10 backdrop-blur-sm p-4 -rotate-6"
            >
              <div className="w-full h-36 md:h-44 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 mb-3" />
              <div className="h-2.5 w-3/4 bg-white/10 rounded-full mb-2" />
              <div className="h-2.5 w-1/2 bg-white/10 rounded-full" />
            </motion.div>

            {/* Center card */}
            <motion.div
              animate={{ y: [0, -16, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
              className="w-56 md:w-72 h-72 md:h-[340px] rounded-2xl bg-gradient-to-br from-indigo-600/30 to-purple-600/30 border border-white/10 backdrop-blur-sm p-4 z-10 shadow-2xl shadow-purple-500/10"
            >
              <div className="w-full h-44 md:h-56 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 mb-3" />
              <div className="h-3 w-3/4 bg-white/15 rounded-full mb-2" />
              <div className="h-3 w-1/2 bg-white/10 rounded-full" />
            </motion.div>

            {/* Right card */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
              className="hidden sm:block w-48 md:w-56 h-64 md:h-72 rounded-2xl bg-gradient-to-br from-pink-600/30 to-purple-600/30 border border-white/10 backdrop-blur-sm p-4 rotate-6"
            >
              <div className="w-full h-36 md:h-44 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 mb-3" />
              <div className="h-2.5 w-3/4 bg-white/10 rounded-full mb-2" />
              <div className="h-2.5 w-1/2 bg-white/10 rounded-full" />
            </motion.div>
          </div>

          {/* Glow under cards */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-purple-600/20 blur-[100px] rounded-full" />
        </motion.div>
      </div>
    </section>
  );
}

/* ───────────────────────── Stats ───────────────────────── */

function Stats() {
  return (
    <section className="relative py-20 border-y border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection>
          <div className="text-center mb-12">
            <p className="text-sm uppercase tracking-widest text-white/40 font-medium">
              Trusted by creators worldwide
            </p>
          </div>
        </AnimatedSection>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat, i) => (
            <AnimatedSection key={stat.label} delay={i * 0.1}>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl md:text-5xl font-display font-bold gradient-text mb-2">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </div>
                <p className="text-sm md:text-base text-white/40">{stat.label}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Features ───────────────────────── */

function Features() {
  return (
    <section id="features" className="section-padding relative overflow-hidden">
      <div className="glow-orb w-[400px] h-[400px] bg-purple-600 top-[20%] left-[-100px]" />
      <div className="glow-orb w-[350px] h-[350px] bg-indigo-600 bottom-[10%] right-[-100px]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <AnimatedSection className="text-center mb-16 md:mb-20">
          <Badge className="mb-4">
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            Powerful Features
          </Badge>
          <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl mb-5">
            Everything You Need to{" "}
            <span className="gradient-text">Create & Grow</span>
          </h2>
          <p className="max-w-2xl mx-auto text-white/40 text-lg">
            From AI avatar generation to multi-platform publishing, MagicBox AI gives you the
            complete toolkit to dominate social media.
          </p>
        </AnimatedSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {features.map((feature, i) => (
            <AnimatedSection key={feature.title} delay={i * 0.08}>
              <div className="glass-card-hover p-7 md:p-8 h-full group">
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-display font-semibold text-lg text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-white/40 text-sm leading-relaxed">{feature.description}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Showcase Marquee ───────────────────────── */

function Showcase() {
  const items = [...showcaseItems, ...showcaseItems];

  return (
    <section className="section-padding overflow-hidden">
      <AnimatedSection className="text-center mb-14">
        <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl mb-5">
          AI Content <span className="gradient-text">Showcase</span>
        </h2>
        <p className="max-w-xl mx-auto text-white/40 text-lg">
          See what creators are building with MagicBox AI
        </p>
      </AnimatedSection>

      <div className="relative">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-zinc-950 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-zinc-950 to-transparent z-10 pointer-events-none" />

        <div className="overflow-hidden">
          <div className="marquee-track" style={{ "--duration": "50s" } as React.CSSProperties}>
            {items.map((item, i) => (
              <div
                key={`${item.label}-${i}`}
                className="flex-shrink-0 w-52 md:w-64 rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden group hover:border-white/20 transition-all duration-300"
              >
                <div
                  className={`w-full h-56 md:h-72 bg-gradient-to-br ${item.gradient} opacity-80 group-hover:opacity-100 transition-opacity duration-300`}
                />
                <div className="p-4">
                  <p className="text-sm font-medium text-white/70">{item.label}</p>
                  <p className="text-xs text-white/30 mt-1">AI Generated Avatar</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── How It Works ───────────────────────── */

function HowItWorks() {
  return (
    <section id="how-it-works" className="section-padding relative overflow-hidden">
      <div className="glow-orb w-[350px] h-[350px] bg-violet-600 top-[30%] left-[50%] -translate-x-1/2" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <AnimatedSection className="text-center mb-16 md:mb-20">
          <Badge className="mb-4">Simple Process</Badge>
          <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl mb-5">
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="max-w-xl mx-auto text-white/40 text-lg">
            Get started in minutes, not hours. Three simple steps to transform your content.
          </p>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-8 md:gap-6 relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-24 left-[20%] right-[20%] h-px bg-gradient-to-r from-purple-500/30 via-indigo-500/30 to-blue-500/30" />

          {steps.map((step, i) => (
            <AnimatedSection key={step.step} delay={i * 0.15}>
              <div className="glass-card p-8 text-center relative group hover:bg-white/[0.05] transition-all duration-500">
                <div
                  className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${step.gradient} text-2xl font-display font-bold mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}
                >
                  {step.step}
                </div>
                <h3 className="font-display font-semibold text-xl text-white mb-3">
                  {step.title}
                </h3>
                <p className="text-white/40 text-sm leading-relaxed">{step.description}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Pricing ───────────────────────── */

function Pricing() {
  return (
    <section id="pricing" className="section-padding relative overflow-hidden">
      <div className="glow-orb w-[500px] h-[500px] bg-purple-600 top-[20%] right-[-200px]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <AnimatedSection className="text-center mb-16 md:mb-20">
          <Badge className="mb-4">Pricing</Badge>
          <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl mb-5">
            Simple, Transparent <span className="gradient-text">Pricing</span>
          </h2>
          <p className="max-w-xl mx-auto text-white/40 text-lg">
            Start free, upgrade when you're ready. No hidden fees, cancel anytime.
          </p>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-6 md:gap-5 max-w-5xl mx-auto items-start">
          {pricingTiers.map((tier, i) => (
            <AnimatedSection key={tier.name} delay={i * 0.12}>
              <div
                className={`relative rounded-2xl p-7 md:p-8 h-full transition-all duration-500 ${
                  tier.popular
                    ? "bg-gradient-to-b from-purple-500/[0.12] to-indigo-500/[0.06] border-2 border-purple-500/30 shadow-xl shadow-purple-500/10 md:scale-105"
                    : "glass-card hover:bg-white/[0.05]"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <Badge className="px-4 py-1 bg-purple-600 border-purple-500 text-white text-xs font-semibold">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="font-display font-semibold text-lg text-white mb-1">
                    {tier.name}
                  </h3>
                  <p className="text-white/40 text-sm mb-4">{tier.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl md:text-5xl font-display font-bold text-white">
                      {tier.price}
                    </span>
                    {tier.period && (
                      <span className="text-white/40 text-sm">{tier.period}</span>
                    )}
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-white/60">
                      <Check className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <a href={APP_URL} className="block">
                  {tier.popular ? (
                    <button className="btn-gradient w-full h-12 text-sm font-semibold">
                      {tier.cta}
                      <ArrowRight className="w-4 h-4 ml-1 inline" />
                    </button>
                  ) : (
                    <Button variant="outline" className="w-full h-12">
                      {tier.cta}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </a>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Testimonials ───────────────────────── */

function Testimonials() {
  return (
    <section className="section-padding relative overflow-hidden">
      <div className="glow-orb w-[400px] h-[400px] bg-indigo-600 bottom-[-100px] left-[20%]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <AnimatedSection className="text-center mb-16 md:mb-20">
          <Badge className="mb-4">
            <Star className="w-3.5 h-3.5 mr-1" />
            Testimonials
          </Badge>
          <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl mb-5">
            Loved by <span className="gradient-text">Creators</span>
          </h2>
          <p className="max-w-xl mx-auto text-white/40 text-lg">
            See why thousands of creators choose MagicBox AI for their content workflow.
          </p>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <AnimatedSection key={t.name} delay={i * 0.12}>
              <div className="glass-card-hover p-7 md:p-8 h-full flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star
                      key={j}
                      className="w-4 h-4 text-amber-400 fill-amber-400"
                    />
                  ))}
                </div>
                <p className="text-white/60 text-sm leading-relaxed mb-6 flex-1">
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                  <div
                    className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.gradient} flex items-center justify-center text-sm font-semibold text-white`}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{t.name}</p>
                    <p className="text-xs text-white/40">{t.role}</p>
                  </div>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Final CTA ───────────────────────── */

function FinalCTA() {
  return (
    <section className="section-padding">
      <AnimatedSection>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl overflow-hidden p-10 md:p-16 text-center">
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-indigo-600/20 to-violet-600/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/50 to-transparent" />
            <div className="absolute inset-[1px] rounded-3xl border border-white/[0.08]" />

            {/* Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
            <div className="glow-orb w-[300px] h-[300px] bg-purple-600 top-[-100px] left-[50%] -translate-x-1/2 opacity-30" />

            <div className="relative z-10">
              <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl mb-5">
                Ready to Transform
                <br />
                <span className="gradient-text">Your Content?</span>
              </h2>
              <p className="max-w-lg mx-auto text-white/50 text-lg mb-8">
                Join 10,000+ creators already using MagicBox AI to build their brand and grow their
                audience.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a href={APP_URL}>
                  <button className="btn-gradient h-13 px-10 text-base gap-2">
                    Get Started Free
                    <ArrowRight className="w-5 h-5 inline" />
                  </button>
                </a>
                <a
                  href={APP_URL}
                  className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"
                >
                  View all features
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>
    </section>
  );
}

/* ───────────────────────── Footer ───────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-white/[0.04] pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <a href="#" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-display font-bold text-white">
                MagicBox <span className="gradient-text">AI</span>
              </span>
            </a>
            <p className="text-sm text-white/30 leading-relaxed max-w-xs">
              The all-in-one AI platform for creating stunning avatars and social media content.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-white mb-4">{category}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-white/30 hover:text-white/60 transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/[0.04] pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-white/20">
            &copy; {new Date().getFullYear()} MagicBox AI. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-xs text-white/20 hover:text-white/40 transition-colors">
              Privacy
            </a>
            <a href="#" className="text-xs text-white/20 hover:text-white/40 transition-colors">
              Terms
            </a>
            <a href="#" className="text-xs text-white/20 hover:text-white/40 transition-colors">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ───────────────────────── Landing Page ───────────────────────── */

export default function Landing() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-x-hidden">
      <Navbar />
      <Hero />
      <Stats />
      <Features />
      <Showcase />
      <HowItWorks />
      <Pricing />
      <Testimonials />
      <FinalCTA />
      <Footer />
    </div>
  );
}
