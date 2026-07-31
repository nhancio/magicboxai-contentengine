import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  PenLine,
  Send,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { appLoginUrl } from "@/lib/config";
import { captureEvent } from "@shared/lib/analytics";
import { InstagramLogo, LinkedInLogo, YouTubeLogo } from "./channel-logos";

const CHANNELS = [
  { name: "Instagram", Logo: InstagramLogo },
  { name: "LinkedIn", Logo: LinkedInLogo },
  { name: "YouTube", Logo: YouTubeLogo },
];

function PhoneShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[2rem] bg-[#0b1015] p-[5px] shadow-[0_26px_55px_rgba(1,7,12,0.38)] ${className}`}
    >
      <div className="relative h-full overflow-hidden rounded-[1.7rem] bg-[#f7f7f3] text-[#17212a]">
        <div className="absolute left-1/2 top-2 z-20 h-4 w-[62px] -translate-x-1/2 rounded-full bg-[#0b1015]" />
        <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white/80 to-transparent" />
        {children}
      </div>
    </div>
  );
}

function TinyStatus({ children, tone = "ink" }: { children: ReactNode; tone?: "ink" | "violet" | "mint" }) {
  const tones = {
    ink: "bg-[#e8ebe8] text-[#52606a]",
    violet: "bg-[#efe8ff] text-[#7651c8]",
    mint: "bg-[#dcf4e8] text-[#247252]",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-[7px] font-semibold tracking-[0.06em] ${tones[tone]}`}>
      {children}
    </span>
  );
}

function PlanPhone() {
  return (
    <PhoneShell className="h-[330px] w-[164px] sm:h-[360px] sm:w-[178px]">
      <div className="h-full px-3 pb-3 pt-9">
        <div className="flex items-center justify-between">
          <div className="text-[9px] font-bold tracking-tight">MagicBox</div>
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[#dfe9ff] text-[8px] font-bold text-[#3c5da7]">MB</span>
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-[8px] text-[#7c8790]">YOUR WEEK</p>
            <p className="mt-0.5 text-[13px] font-semibold tracking-tight">12–16 May</p>
          </div>
          <CalendarDays className="h-4 w-4 text-[#8d70d6]" />
        </div>
        <div className="mt-4 space-y-2">
          {[
            ["Mon", "Launch note", "violet"],
            ["Wed", "Customer story", "mint"],
            ["Fri", "Founder POV", "ink"],
          ].map(([day, title, tone]) => (
            <div key={day} className="flex items-center gap-2 rounded-xl border border-[#e5e7e2] bg-white p-2 shadow-[0_4px_12px_rgba(21,33,42,0.04)]">
              <span className="grid h-5 w-5 place-items-center rounded-lg bg-[#f0f0ec] text-[7px] font-bold text-[#61707b]">{day}</span>
              <span className="min-w-0 flex-1 truncate text-[8px] font-medium">{title}</span>
              <span className={`h-1.5 w-1.5 rounded-full ${tone === "violet" ? "bg-[#956ee5]" : tone === "mint" ? "bg-[#4bb889]" : "bg-[#aab3b5]"}`} />
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl bg-[#1c2b35] p-2.5 text-white">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-[#c8b4ff]" />
            <span className="text-[8px] font-medium">3 ideas ready</span>
          </div>
          <div className="mt-2 h-1 rounded-full bg-white/15"><div className="h-full w-2/3 rounded-full bg-[#b69af8]" /></div>
        </div>
      </div>
    </PhoneShell>
  );
}

function DraftPhone() {
  return (
    <PhoneShell className="h-[405px] w-[202px] sm:h-[440px] sm:w-[220px] lg:h-[492px] lg:w-[245px]">
      <div className="h-full px-3.5 pb-3.5 pt-9">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold tracking-tight">Review draft</div>
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[#eadfff] text-[#7651c8]"><PenLine className="h-2.5 w-2.5" /></span>
        </div>
        <div className="mt-4 rounded-2xl bg-[#172a35] p-3 text-white shadow-[0_10px_24px_rgba(17,32,42,0.18)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5"><span className="grid h-5 w-5 place-items-center rounded-md bg-[#e5d8ff] text-[7px] font-bold text-[#6d4ac0]">LL</span><span className="text-[8px] font-medium">Luma Lab</span></div>
            <TinyStatus tone="mint">ON-BRAND</TinyStatus>
          </div>
          <p className="mt-4 text-[12px] font-medium leading-[1.35]">The small change that made our launch plan easier to keep.</p>
          <div className="mt-3 rounded-xl bg-[linear-gradient(135deg,#8b70d8,#d4b4e5_58%,#f4c584)] p-3">
            <div className="rounded-lg border border-white/35 bg-white/15 p-2 backdrop-blur-sm">
              <p className="text-[7px] uppercase tracking-[0.14em] text-white/70">FOUNDER NOTE</p>
              <p className="mt-1 text-[9px] font-medium leading-snug">Make the plan simple enough to ship.</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[8px] text-white/65"><InstagramLogo className="h-3 w-3" /> Instagram <span className="text-white/25">•</span> <LinkedInLogo className="h-3 w-3" /> LinkedIn</div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl border border-[#e5e7e2] bg-white px-2.5 py-2.5">
          <div className="flex items-center gap-1.5"><FileText className="h-3 w-3 text-[#8d70d6]" /><span className="text-[8px] font-medium">Brand kit applied</span></div>
          <Check className="h-3 w-3 text-[#30a474]" />
        </div>
        <button type="button" aria-label="Ready for review" className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#8c62df] py-2.5 text-[9px] font-semibold text-white shadow-[0_8px_18px_rgba(113,75,195,0.22)]">
          Ready for review <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </PhoneShell>
  );
}

function PublishPhone() {
  return (
    <PhoneShell className="h-[330px] w-[164px] sm:h-[360px] sm:w-[178px]">
      <div className="h-full px-3 pb-3 pt-9">
        <div className="flex items-center justify-between">
          <div className="text-[9px] font-bold tracking-tight">Publish queue</div>
          <Send className="h-3.5 w-3.5 text-[#8d70d6]" />
        </div>
        <div className="mt-4 rounded-2xl bg-[#eef0ec] p-2.5">
          <div className="flex items-center justify-between text-[8px] font-medium"><span>Friday, 10:30</span><Clock3 className="h-3 w-3 text-[#7a858d]" /></div>
          <div className="mt-3 rounded-xl bg-white p-2 shadow-sm">
            <div className="flex items-center gap-1.5"><span className="grid h-5 w-5 place-items-center rounded-md bg-[#f3e7e9] text-[7px] font-bold text-[#c24b70]">IG</span><span className="text-[8px] font-medium">Launch note</span></div>
            <div className="mt-2 h-1.5 rounded-full bg-[#ecece7]"><div className="h-full w-4/5 rounded-full bg-[#d384a3]" /></div>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {[
            ["LinkedIn", "11:00", "bg-[#dfeafe] text-[#2767b0]"],
            ["YouTube", "14:30", "bg-[#ffe8e6] text-[#c83a2f]"],
          ].map(([channel, time, colour]) => (
            <div key={channel} className="flex items-center justify-between rounded-xl border border-[#e5e7e2] bg-white px-2.5 py-2">
              <div className="flex items-center gap-1.5"><span className={`grid h-5 w-5 place-items-center rounded-md text-[7px] font-bold ${colour}`}>{channel.slice(0, 2)}</span><span className="text-[8px] font-medium">{channel}</span></div>
              <span className="text-[7px] text-[#7c8790]">{time}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-[#dcf4e8] px-2.5 py-2 text-[#247252]"><CheckCircle2 className="h-3 w-3" /><span className="text-[8px] font-semibold">2 posts scheduled</span></div>
      </div>
    </PhoneShell>
  );
}

function HeroPhoneStage({ isVisible }: { isVisible: boolean }) {
  return (
    <div data-testid="hero-phone-stage" className="relative min-h-[520px] overflow-hidden bg-[#172a35] px-4 py-5 sm:min-h-[570px] lg:min-h-[680px] lg:px-8 lg:py-8">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)", backgroundSize: "38px 38px" }} />
      <div className="absolute -right-28 top-20 h-72 w-72 rounded-full bg-[#7956cb]/30 blur-3xl" />
      <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-[#4ea987]/20 blur-3xl" />

      <div className="relative z-10 flex items-center justify-between text-[9px] font-medium tracking-[0.18em] text-white/80">
        <span>MAGICBOX / WEEKLY FLOW</span>
        <span className="hidden sm:block">12–16 MAY</span>
      </div>

      <div className={`absolute left-[3%] top-[31%] z-10 hidden -rotate-[10deg] transition-all duration-700 sm:block lg:left-[5%] lg:top-[26%] ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
        <PlanPhone />
      </div>
      <div className={`absolute left-1/2 top-[14%] z-30 -translate-x-1/2 transition-all delay-100 duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>
        <DraftPhone />
      </div>
      <div className={`absolute right-[3%] top-[31%] z-20 hidden rotate-[10deg] transition-all delay-200 duration-700 sm:block lg:right-[5%] lg:top-[26%] ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
        <PublishPhone />
      </div>

      <div className="absolute bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-white/15 bg-[#13232c]/80 px-3 py-2 text-[9px] text-white/80 shadow-lg backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-[#68d1a6]" />
        From brief to scheduled in one view
      </div>
    </div>
  );
}

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section className="relative overflow-hidden pb-12 pt-24 sm:pt-28 lg:pb-20 lg:pt-32">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="flex flex-col overflow-hidden rounded-[2rem] border border-foreground/10 bg-[#f1f1ed] shadow-[0_24px_70px_rgba(27,34,38,0.08)] lg:grid lg:grid-cols-[minmax(0,.86fr)_minmax(560px,1.14fr)]">
          <div className={`order-2 flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-12 lg:order-1 lg:px-14 lg:py-16 transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Social, without the scramble</p>
            <h1 className="mt-4 max-w-[9ch] font-display text-[clamp(3rem,5.4vw,5.6rem)] leading-[0.9] tracking-[-0.055em] text-foreground">
              A calmer way to run social.
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
              Turn one weekly brief into an on-brand plan, ready to review and publish across your connected channels.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" variant="brand" className="group h-14 rounded-full px-7 text-base shadow-[0_10px_22px_rgba(113,75,195,0.22)]">
                <a href={appLoginUrl()} onClick={() => captureEvent("landing_cta_clicked", { cta: "hero_create_plan", destination: "onboarding" })}>
                  Create your week&apos;s plan
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </a>
              </Button>
              <a href="#how-it-works" className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium text-foreground/85 transition-colors hover:text-foreground sm:justify-start">
                See the workflow <ChevronRight className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-9 border-t border-foreground/10 pt-5">
              <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Built for the channels you already use</p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {CHANNELS.map(({ name, Logo }) => (
                  <span key={name} className="inline-flex items-center gap-2 text-xs font-medium text-foreground/85"><Logo className="h-3.5 w-3.5" />{name}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <HeroPhoneStage isVisible={isVisible} />
          </div>
        </div>
      </div>
    </section>
  );
}
