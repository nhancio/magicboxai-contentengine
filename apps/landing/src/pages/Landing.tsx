import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  Video,
  Users,
  Wand2,
  Sparkles,
  ArrowRight,
  Play,
  Check,
  Menu,
  X,
  Zap,
  Star,
  ChevronRight,
  ExternalLink,
  Film,
  Megaphone,
  Package,
  Share2,
  MessageSquare,
  LayoutTemplate,
} from "lucide-react";
import { Button } from "@shared/components/ui/button";
import { Badge } from "@shared/components/ui/badge";

const APP_URL = import.meta.env.DEV ? "http://localhost:5174" : "https://app.magicboxai.in";
const LOGIN_URL = import.meta.env.DEV ? "http://localhost:5174/login" : "https://app.magicboxai.in/login";

/* ───────────────────────── Data ───────────────────────── */

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Templates", href: "#templates" },
  { label: "Pricing", href: "#pricing" },
  { label: "How It Works", href: "#how-it-works" },
];

const stats = [
  { value: 10, suffix: "K+", label: "Creators" },
  { value: 500, suffix: "K+", label: "Videos Generated" },
  { value: 10, suffix: "", label: "Viral Templates" },
  { value: 8, suffix: "", label: "AI Avatars" },
];

const features = [
  {
    icon: Users,
    title: "AI Avatar Library",
    description:
      "8 pre-built UGC-style avatars with unique personalities, voices, and styles. From GenZ energy to luxury influencer vibes.",
    gradient: "from-purple-500 to-violet-600",
  },
  {
    icon: LayoutTemplate,
    title: "Viral Template Engine",
    description:
      "10 proven viral formats like Problem-Solution, GRWM, Unboxing, and Storytime. Each template is optimized for maximum engagement.",
    gradient: "from-indigo-500 to-blue-600",
  },
  {
    icon: Wand2,
    title: "AI Script Generator",
    description:
      "Gemini-powered scripts that convert. Just describe your product and get scroll-stopping scripts tailored to each template format.",
    gradient: "from-pink-500 to-rose-600",
  },
  {
    icon: Package,
    title: "Product Integration",
    description:
      "Upload your product images and let AI seamlessly integrate them into your UGC videos. No studio, no props, no hassle.",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    icon: Share2,
    title: "Multi-Platform Export",
    description:
      "Export videos perfectly sized for TikTok, Instagram Reels, and YouTube Shorts. One click, three platforms ready.",
    gradient: "from-amber-500 to-orange-600",
  },
  {
    icon: MessageSquare,
    title: "Hook Optimizer",
    description:
      "AI generates scroll-stopping hooks proven to capture attention in the first 2 seconds. A/B test different hooks instantly.",
    gradient: "from-cyan-500 to-sky-600",
  },
];

const avatars = [
  {
    name: "Zara",
    personality: "GenZ Girl",
    useCases: "Beauty, Fashion, Lifestyle",
    gradient: "from-pink-500 via-rose-500 to-red-500",
  },
  {
    name: "Marcus",
    personality: "Tech Bro",
    useCases: "SaaS, Apps, Gadgets",
    gradient: "from-blue-500 via-indigo-500 to-violet-500",
  },
  {
    name: "Victoria",
    personality: "Luxury Influencer",
    useCases: "Premium, Luxury, Wellness",
    gradient: "from-amber-400 via-yellow-500 to-orange-500",
  },
  {
    name: "Tyler",
    personality: "Fitness Coach",
    useCases: "Supplements, Activewear, Health",
    gradient: "from-emerald-500 via-green-500 to-teal-500",
  },
  {
    name: "Sarah",
    personality: "Relatable Mom",
    useCases: "Home, Kids, Family Products",
    gradient: "from-purple-400 via-fuchsia-500 to-pink-500",
  },
  {
    name: "Alex",
    personality: "Entrepreneur",
    useCases: "Courses, Tools, Business",
    gradient: "from-slate-400 via-zinc-500 to-neutral-600",
  },
  {
    name: "Luna",
    personality: "Aesthetic Creator",
    useCases: "Skincare, Decor, Stationery",
    gradient: "from-violet-400 via-purple-500 to-indigo-500",
  },
  {
    name: "Jake",
    personality: "Comedy Creator",
    useCases: "Food, Gaming, Everyday Products",
    gradient: "from-orange-500 via-red-500 to-pink-500",
  },
];

const templates = [
  {
    name: "Problem \u2192 Solution",
    hook: "\"Stop wasting money on...\"",
    tone: "Urgent & Direct",
    platforms: ["TikTok", "Reels"],
    gradient: "from-red-500 to-rose-600",
  },
  {
    name: "Get Ready With Me",
    hook: "\"GRWM while I tell you about...\"",
    tone: "Casual & Relatable",
    platforms: ["TikTok", "Reels", "Shorts"],
    gradient: "from-pink-500 to-fuchsia-600",
  },
  {
    name: "3 Reasons Why",
    hook: "\"3 reasons why you need this...\"",
    tone: "Listicle & Punchy",
    platforms: ["TikTok", "Reels"],
    gradient: "from-purple-500 to-violet-600",
  },
  {
    name: "Unboxing",
    hook: "\"Let me unbox this viral product...\"",
    tone: "Excited & Authentic",
    platforms: ["TikTok", "Shorts"],
    gradient: "from-indigo-500 to-blue-600",
  },
  {
    name: "Before & After",
    hook: "\"Watch this transformation...\"",
    tone: "Dramatic & Visual",
    platforms: ["Reels", "TikTok"],
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    name: "Storytime",
    hook: "\"Storytime: How I discovered...\"",
    tone: "Narrative & Personal",
    platforms: ["TikTok", "Reels", "Shorts"],
    gradient: "from-amber-500 to-orange-600",
  },
];

const steps = [
  {
    step: "01",
    icon: Users,
    title: "Pick Your Avatar",
    description:
      "Choose from 8 AI personalities, each with their own style, voice, and vibe. From GenZ energy to luxury influencer aesthetics.",
    gradient: "from-purple-500 to-indigo-500",
  },
  {
    step: "02",
    icon: LayoutTemplate,
    title: "Choose a Viral Template",
    description:
      "Select from 10 proven viral formats. Problem-Solution, GRWM, Unboxing, Storytime, and more. Each template is battle-tested.",
    gradient: "from-indigo-500 to-blue-500",
  },
  {
    step: "03",
    icon: Film,
    title: "Generate & Export",
    description:
      "AI creates your UGC video in seconds. Add your product, customize the script, and export for TikTok, Reels, or Shorts.",
    gradient: "from-blue-500 to-violet-500",
  },
];

const pricingTiers = [
  {
    name: "Free",
    price: "$0",
    period: "",
    badge: "FREE During Launch!",
    description: "Everything you need to start creating",
    features: [
      "10 videos per month",
      "All 8 AI avatars",
      "All 10 viral templates",
      "AI script generator",
      "720p export quality",
      "MagicBox watermark",
    ],
    cta: "Start Creating Free",
    popular: false,
    gradient: "from-zinc-600 to-zinc-700",
  },
  {
    name: "Creator",
    price: "$29",
    period: "/month",
    badge: "Most Popular",
    description: "For serious content creators",
    features: [
      "50 videos per month",
      "All 8 AI avatars",
      "All 10 viral templates",
      "AI script generator",
      "1080p export quality",
      "No watermark",
      "Priority rendering",
      "Hook A/B testing",
    ],
    cta: "Start Creator Plan",
    popular: true,
    gradient: "from-purple-600 to-indigo-600",
  },
  {
    name: "Pro",
    price: "$79",
    period: "/month",
    badge: null,
    description: "For agencies & power users",
    features: [
      "200 videos per month",
      "All 8 AI avatars",
      "All 10 viral templates",
      "AI script generator",
      "4K export quality",
      "No watermark",
      "API access",
      "Bulk generation",
      "Custom avatar training",
      "Priority support",
    ],
    cta: "Start Pro Plan",
    popular: false,
    gradient: "from-indigo-600 to-blue-600",
  },
];

const testimonials = [
  {
    name: "Jessica Kim",
    role: "DTC Brand Owner",
    initials: "JK",
    quote:
      "We replaced our entire UGC creator budget with MagicBox AI. 50 videos a month for $29 vs paying creators $200+ per video. The ROI is insane.",
    gradient: "from-pink-500 to-rose-500",
  },
  {
    name: "Daniel Torres",
    role: "TikTok Creator \u2022 120K Followers",
    initials: "DT",
    quote:
      "I use MagicBox to batch-create content for my brand deals. Pick an avatar, choose a template, and I have a scroll-stopping video in 60 seconds. Game changer.",
    gradient: "from-purple-500 to-indigo-500",
  },
  {
    name: "Aisha Patel",
    role: "Social Media Agency CEO",
    initials: "AP",
    quote:
      "Our agency manages 30+ brands. MagicBox AI lets us produce UGC-style content at scale without hiring creators. The template library is pure gold.",
    gradient: "from-indigo-500 to-blue-500",
  },
];

const footerLinks = {
  Product: ["Features", "Templates", "Pricing", "API", "Changelog"],
  Company: ["About", "Blog", "Careers", "Press", "Partners"],
  Legal: ["Privacy Policy", "Terms of Service", "Cookie Policy", "GDPR"],
  Social: ["Twitter", "Instagram", "LinkedIn", "YouTube", "TikTok"],
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
    const stepTime = Math.max((duration * 1000) / end, 10);
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
      {count.toLocaleString()}
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
                Start Creating
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
                  Start Creating <ArrowRight className="w-4 h-4 ml-1 inline" />
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
            FREE During Launch &mdash; Create Viral UGC Videos in 60 Seconds
          </Badge>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
          className="font-display font-extrabold text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight leading-[1.05] mb-6"
        >
          Create Viral{" "}
          <span className="gradient-text">UGC Videos</span>
          <br />
          with <span className="gradient-text-alt">AI Avatars</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="max-w-2xl mx-auto text-lg md:text-xl text-white/50 leading-relaxed mb-4"
        >
          Turn products into scroll-stopping content. Select an AI avatar, pick a proven viral
          template, and generate UGC videos that convert &mdash; all in under 60 seconds.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.38, ease: "easeOut" }}
          className="max-w-xl mx-auto text-sm text-white/30 mb-10"
        >
          No creators to hire. No studios to book. No editing skills needed.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease: "easeOut" }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a href={APP_URL}>
            <button className="btn-gradient h-13 px-10 text-base gap-2">
              Start Creating Free
              <ArrowRight className="w-5 h-5 inline" />
            </button>
          </a>
          <button className="btn-outline-glow h-13 px-10 text-base gap-2">
            <Play className="w-5 h-5" />
            Watch Demo
          </button>
        </motion.div>

        {/* Floating phone mockups */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.7, ease: "easeOut" }}
          className="mt-20 relative max-w-5xl mx-auto"
        >
          <div className="relative flex items-center justify-center gap-4 md:gap-6">
            {/* Left phone */}
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="hidden sm:block w-44 md:w-52 h-72 md:h-80 rounded-[2rem] bg-zinc-900/80 border-2 border-white/10 backdrop-blur-sm p-2 -rotate-6 shadow-xl"
            >
              <div className="w-full h-full rounded-[1.5rem] bg-gradient-to-br from-purple-600 via-pink-500 to-rose-500 relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Play className="w-10 h-10 text-white/80 mx-auto mb-2" />
                    <p className="text-xs text-white/70 font-medium">Problem → Solution</p>
                  </div>
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="h-2 w-3/4 bg-white/20 rounded-full mb-1.5" />
                  <div className="h-2 w-1/2 bg-white/15 rounded-full" />
                </div>
              </div>
            </motion.div>

            {/* Center phone */}
            <motion.div
              animate={{ y: [0, -16, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
              className="w-52 md:w-64 h-80 md:h-[380px] rounded-[2rem] bg-zinc-900/80 border-2 border-purple-500/30 backdrop-blur-sm p-2 z-10 shadow-2xl shadow-purple-500/20"
            >
              <div className="w-full h-full rounded-[1.5rem] bg-gradient-to-br from-indigo-600 via-purple-500 to-violet-600 relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm mx-auto mb-3 flex items-center justify-center">
                      <Play className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-sm text-white/90 font-semibold">UGC Video</p>
                    <p className="text-xs text-white/60 mt-1">AI Avatar: Zara</p>
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="h-2.5 w-3/4 bg-white/20 rounded-full mb-2" />
                  <div className="h-2.5 w-1/2 bg-white/15 rounded-full" />
                </div>
              </div>
            </motion.div>

            {/* Right phone */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
              className="hidden sm:block w-44 md:w-52 h-72 md:h-80 rounded-[2rem] bg-zinc-900/80 border-2 border-white/10 backdrop-blur-sm p-2 rotate-6 shadow-xl"
            >
              <div className="w-full h-full rounded-[1.5rem] bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Play className="w-10 h-10 text-white/80 mx-auto mb-2" />
                    <p className="text-xs text-white/70 font-medium">Get Ready With Me</p>
                  </div>
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="h-2 w-3/4 bg-white/20 rounded-full mb-1.5" />
                  <div className="h-2 w-1/2 bg-white/15 rounded-full" />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Glow under phones */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-purple-600/20 blur-[100px] rounded-full" />
        </motion.div>
      </div>
    </section>
  );
}

/* ───────────────────────── Stats ───────────────────────── */

function StatsSection() {
  return (
    <section className="relative py-20 border-y border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection>
          <div className="text-center mb-12">
            <p className="text-sm uppercase tracking-widest text-white/40 font-medium">
              Trusted by creators & brands worldwide
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

/* ───────────────────────── How It Works ───────────────────────── */

function HowItWorks() {
  return (
    <section id="how-it-works" className="section-padding relative overflow-hidden">
      <div className="glow-orb w-[350px] h-[350px] bg-violet-600 top-[30%] left-[50%] -translate-x-1/2" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <AnimatedSection className="text-center mb-16 md:mb-20">
          <Badge className="mb-4">Simple 3-Step Process</Badge>
          <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl mb-5">
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="max-w-xl mx-auto text-white/40 text-lg">
            Go from zero to viral-ready UGC video in under 60 seconds. No editing skills required.
          </p>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-8 md:gap-6 relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-24 left-[20%] right-[20%] h-px bg-gradient-to-r from-purple-500/30 via-indigo-500/30 to-blue-500/30" />

          {steps.map((step, i) => (
            <AnimatedSection key={step.step} delay={i * 0.15}>
              <div className="glass-card p-8 text-center relative group hover:bg-white/[0.05] transition-all duration-500">
                <div
                  className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${step.gradient} mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}
                >
                  <step.icon className="w-7 h-7 text-white" />
                </div>
                <div className="text-xs font-mono text-white/30 mb-2">Step {step.step}</div>
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
            <span className="gradient-text">Go Viral</span>
          </h2>
          <p className="max-w-2xl mx-auto text-white/40 text-lg">
            From AI avatars to viral templates, MagicBox AI gives you the complete
            toolkit to create scroll-stopping UGC content at scale.
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

/* ───────────────────────── Avatar Showcase ───────────────────────── */

function AvatarShowcase() {
  return (
    <section className="section-padding relative overflow-hidden">
      <div className="glow-orb w-[400px] h-[400px] bg-pink-600 top-[10%] right-[-100px]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <AnimatedSection className="text-center mb-14">
          <Badge className="mb-4">
            <Users className="w-3.5 h-3.5 mr-1" />
            Meet Your Avatars
          </Badge>
          <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl mb-5">
            8 AI Avatars, <span className="gradient-text">Infinite Content</span>
          </h2>
          <p className="max-w-xl mx-auto text-white/40 text-lg">
            Each avatar has a unique personality, speaking style, and aesthetic. Pick the perfect
            creator for your brand.
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
          {avatars.map((avatar, i) => (
            <AnimatedSection key={avatar.name} delay={i * 0.06}>
              <div className="glass-card-hover p-5 md:p-6 text-center group h-full">
                <div
                  className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${avatar.gradient} mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300 flex items-center justify-center`}
                >
                  <span className="text-2xl font-display font-bold text-white">
                    {avatar.name[0]}
                  </span>
                </div>
                <h3 className="font-display font-semibold text-base text-white mb-1">
                  {avatar.name}
                </h3>
                <p className="text-sm text-purple-400 font-medium mb-2">{avatar.personality}</p>
                <p className="text-xs text-white/30 leading-relaxed">{avatar.useCases}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Template Preview ───────────────────────── */

function TemplatePreview() {
  return (
    <section id="templates" className="section-padding relative overflow-hidden">
      <div className="glow-orb w-[400px] h-[400px] bg-indigo-600 bottom-[10%] left-[-100px]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <AnimatedSection className="text-center mb-14">
          <Badge className="mb-4">
            <Video className="w-3.5 h-3.5 mr-1" />
            Viral Templates
          </Badge>
          <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl mb-5">
            Proven Formats That{" "}
            <span className="gradient-text">Go Viral</span>
          </h2>
          <p className="max-w-xl mx-auto text-white/40 text-lg">
            Battle-tested UGC templates that have generated millions of views. Just add your product.
          </p>
        </AnimatedSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {templates.map((template, i) => (
            <AnimatedSection key={template.name} delay={i * 0.08}>
              <div className="glass-card-hover p-6 md:p-7 h-full group">
                <div
                  className={`w-full h-28 rounded-xl bg-gradient-to-br ${template.gradient} mb-5 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity duration-300`}
                >
                  <Film className="w-8 h-8 text-white/70" />
                </div>
                <h3 className="font-display font-semibold text-base text-white mb-2">
                  {template.name}
                </h3>
                <p className="text-sm text-white/50 italic mb-3">{template.hook}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-purple-400 font-medium">{template.tone}</span>
                  <div className="flex gap-1.5">
                    {template.platforms.map((platform) => (
                      <span
                        key={platform}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40 border border-white/[0.08]"
                      >
                        {platform}
                      </span>
                    ))}
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
            Start free during our launch period. No credit card required. Upgrade when you need more.
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
                {tier.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <Badge
                      className={`px-4 py-1 text-white text-xs font-semibold ${
                        tier.popular
                          ? "bg-purple-600 border-purple-500"
                          : "bg-emerald-600 border-emerald-500"
                      }`}
                    >
                      {tier.badge}
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
            Loved by <span className="gradient-text">Creators & Brands</span>
          </h2>
          <p className="max-w-xl mx-auto text-white/40 text-lg">
            See why thousands of creators and DTC brands choose MagicBox AI for their UGC content.
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
                  &ldquo;{t.quote}&rdquo;
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
                Start Creating Viral
                <br />
                <span className="gradient-text">UGC Videos Today</span>
              </h2>
              <p className="max-w-lg mx-auto text-white/50 text-lg mb-3">
                Join 10,000+ creators already using MagicBox AI to generate scroll-stopping
                UGC content with AI avatars.
              </p>
              <p className="text-sm text-purple-400 font-medium mb-8">
                It&apos;s completely free during launch. No credit card required.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a href={APP_URL}>
                  <button className="btn-gradient h-13 px-10 text-base gap-2">
                    Start Creating Free
                    <ArrowRight className="w-5 h-5 inline" />
                  </button>
                </a>
                <a
                  href={APP_URL}
                  className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"
                >
                  View all templates
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
              The AI-powered platform for creating viral UGC videos with AI avatars and proven templates.
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
      <StatsSection />
      <HowItWorks />
      <Features />
      <AvatarShowcase />
      <TemplatePreview />
      <Pricing />
      <Testimonials />
      <FinalCTA />
      <Footer />
    </div>
  );
}
