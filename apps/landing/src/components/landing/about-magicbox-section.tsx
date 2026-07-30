import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  Check,
  FileText,
  LockKeyhole,
  PenLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { InstagramLogo, LinkedInLogo, YouTubeLogo } from "./channel-logos";

const WORKFLOW = [
  {
    number: "01",
    label: "Brief",
    detail: "Your brand context and one clear content direction.",
    Icon: FileText,
  },
  {
    number: "02",
    label: "Create",
    detail: "Channel-specific copy and media shaped to the brief.",
    Icon: Sparkles,
  },
  {
    number: "03",
    label: "Review",
    detail: "Approve the draft or make it unmistakably yours.",
    Icon: PenLine,
  },
  {
    number: "04",
    label: "Publish",
    detail: "Schedule to the connected channels you choose.",
    Icon: CalendarClock,
  },
] as const;

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white/50">
      <span className="h-px w-8 bg-white/25" />
      {children}
    </span>
  );
}

function ScopeChip({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-full border border-[#172a35]/10 bg-[#172a35]/[0.055] px-3 py-1.5 font-mono text-[11px] text-[#172a35]">
      {children}
    </code>
  );
}

/**
 * OAuth verification section — Google reviewers need a public page that:
 * 1) Identifies the app as "MagicBox" (must match consent screen)
 * 2) Explains purpose / functionality without login
 * 3) Explains why Google / YouTube user data is requested
 * 4) Links Privacy Policy (same URL as consent screen)
 *
 * @see https://support.google.com/cloud/answer/13807376
 * @see https://support.google.com/cloud/answer/13804963
 */
export function AboutMagicBoxSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.12 },
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="about-magicbox"
      ref={sectionRef}
      aria-labelledby="about-magicbox-title"
      className="relative scroll-mt-24 overflow-hidden border-t border-foreground/10 py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-[#15272f] text-white shadow-[0_28px_80px_rgba(18,38,46,0.16)]">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.13]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.14) 1px, transparent 1px)",
              backgroundSize: "54px 54px",
            }}
          />
          <div className="pointer-events-none absolute -right-24 -top-20 h-80 w-80 rounded-full bg-[#9d79e8]/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-[28%] h-80 w-80 rounded-full bg-[#4db98c]/15 blur-3xl" />

          <div className="relative z-10 px-6 py-8 sm:px-10 sm:py-12 lg:px-14 lg:py-16">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,.92fr)_minmax(560px,1.08fr)] lg:items-end lg:gap-16">
              <div
                className={`transition-all duration-700 motion-reduce:transform-none motion-reduce:transition-none ${
                  isVisible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
                }`}
              >
                <Eyebrow>About MagicBox</Eyebrow>
                <h2
                  id="about-magicbox-title"
                  className="mt-6 max-w-[10ch] font-display text-[clamp(3.1rem,6vw,6.4rem)] leading-[0.9] tracking-[-0.055em]"
                >
                  One brief.
                  <br />
                  A week of social.
                </h2>
                <p className="mt-7 max-w-xl text-base leading-relaxed text-white/68 sm:text-lg">
                  <strong className="font-medium text-white">MagicBox</strong> is AI marketing
                  automation software for creating social content, reviewing drafts, scheduling
                  posts, and publishing to channels you connect.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-white/12 pt-6">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                    Built for
                  </span>
                  <span className="inline-flex items-center gap-2 text-xs font-medium text-white/75">
                    <InstagramLogo className="h-4 w-4" /> Instagram
                  </span>
                  <span className="inline-flex items-center gap-2 text-xs font-medium text-white/75">
                    <LinkedInLogo className="h-4 w-4" /> LinkedIn
                  </span>
                  <span className="inline-flex items-center gap-2 text-xs font-medium text-white/75">
                    <YouTubeLogo className="h-4 w-4" /> YouTube
                  </span>
                </div>
              </div>

              <div
                className={`relative transition-all delay-150 duration-700 motion-reduce:transform-none motion-reduce:transition-none ${
                  isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
                }`}
              >
                <div className="mb-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.17em] text-white/42">
                  <span>The MagicBox loop</span>
                  <span>Human review built in</span>
                </div>
                <div className="overflow-hidden rounded-[1.4rem] border border-white/12 bg-[#102128]/80 shadow-[0_22px_54px_rgba(4,14,18,0.28)] backdrop-blur-sm">
                  {WORKFLOW.map(({ number, label, detail, Icon }) => (
                    <div
                      key={number}
                      className="group grid grid-cols-[42px_44px_minmax(0,1fr)_24px] items-center gap-3 border-b border-white/10 px-4 py-4 last:border-0 sm:grid-cols-[52px_48px_minmax(0,1fr)_30px] sm:px-6 sm:py-5"
                    >
                      <span className="font-mono text-[10px] text-white/35">{number}</span>
                      <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.055] text-[#c7b2fa] transition-colors duration-300 group-hover:bg-white/10">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold tracking-tight sm:text-base">{label}</h3>
                        <p className="mt-0.5 text-xs leading-relaxed text-white/48 sm:text-sm">
                          {detail}
                        </p>
                      </div>
                      <Check className="h-4 w-4 text-[#6fd2a9]" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-14 grid gap-4 lg:mt-16 lg:grid-cols-[minmax(0,.72fr)_minmax(0,1.28fr)]">
              <div
                className={`rounded-[1.5rem] border border-white/12 bg-white/[0.055] p-6 transition-all delay-200 duration-700 motion-reduce:transform-none motion-reduce:transition-none sm:p-8 ${
                  isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#6fd2a9]/12 text-[#8ae2bd]">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">
                    You stay in control
                  </span>
                </div>
                <h3 className="mt-8 max-w-sm font-display text-3xl leading-tight tracking-tight sm:text-4xl">
                  Created by AI.
                  <br />
                  Approved by you.
                </h3>
                <p className="mt-5 max-w-md text-sm leading-relaxed text-white/58 sm:text-base">
                  Core functionality: you enter brand context and a content brief; MagicBox creates
                  channel-specific copy and media; you approve or edit the drafts; MagicBox then
                  publishes or schedules only to accounts you connected.
                </p>
              </div>

              <div
                className={`rounded-[1.5rem] bg-[#f4f3ef] p-6 text-[#17212a] transition-all delay-300 duration-700 motion-reduce:transform-none motion-reduce:transition-none sm:p-8 lg:p-10 ${
                  isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
                }`}
              >
                <div className="flex flex-col gap-7 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-[0_8px_24px_rgba(23,33,42,0.08)]">
                      <YouTubeLogo className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#6f777b]">
                        Google OAuth transparency
                      </p>
                      <h3 className="mt-1 font-display text-3xl tracking-tight sm:text-4xl">
                        YouTube access, explained.
                      </h3>
                    </div>
                  </div>
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#172a35]/10 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#315d4c]">
                    <LockKeyhole className="h-3.5 w-3.5" />
                    Server-side access
                  </span>
                </div>

                <div className="mt-8 grid gap-7 border-t border-[#172a35]/10 pt-7 md:grid-cols-[minmax(0,1fr)_minmax(230px,.72fr)]">
                  <div>
                    <p className="text-sm leading-relaxed text-[#586269] sm:text-base">
                      MagicBox requests Google user data only when you connect a YouTube channel.
                      It uses that access to upload videos you choose to publish and to read the
                      channel metadata needed to complete that publishing flow. It requests only
                      the two YouTube scopes required for this flow.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2" aria-label="Requested YouTube scopes">
                      <ScopeChip>youtube.upload</ScopeChip>
                      <ScopeChip>youtube.readonly</ScopeChip>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#172a35]/10 bg-white/70 p-5">
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#7d8385]">
                      Our data promise
                    </p>
                    <p className="mt-3 text-sm font-medium leading-relaxed text-[#27343b]">
                      Access tokens are stored server-side and used only for actions you initiate.
                      MagicBox does not sell Google user data.
                    </p>
                  </div>
                </div>

                <div className="mt-7 flex flex-col gap-3 border-t border-[#172a35]/10 pt-6 sm:flex-row sm:items-center">
                  <a
                    href="/privacy.html"
                    className="group inline-flex items-center justify-between gap-3 rounded-full bg-[#172a35] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#233b46]"
                  >
                    Privacy Policy
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </a>
                  <a
                    href="/terms.html"
                    className="group inline-flex items-center justify-between gap-3 rounded-full border border-[#172a35]/15 px-5 py-3 text-sm font-medium transition-colors hover:bg-white"
                  >
                    Terms of Service
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-5 rounded-[1.25rem] border border-white/10 bg-black/10 px-5 py-5 text-sm text-white/52 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-white/65" />
                <p>
                  MagicBox is operated by{" "}
                  <strong className="font-medium text-white/85">
                    Nhancio Technologies Private Limited
                  </strong>
                  , Hyderabad, India.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <a
                  href="mailto:support@magicboxai.in"
                  className="transition-colors hover:text-white"
                >
                  support@magicboxai.in
                </a>
                <a
                  href="https://magicboxai.in/"
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-white"
                >
                  magicboxai.in <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
