import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@shared/lib/auth";
import { getUserSubscription, type SubscriptionRecord } from "@shared/lib/firestore";
import { syncBillingClaims } from "@shared/lib/suite";
import { captureEvent, PRODUCT_EVENTS } from "@shared/lib/analytics";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/avatar";
import { Button } from "@shared/components/ui/button";
import { cn } from "@shared/lib/utils";
import { api } from "@convex/_generated/api";
import { isConvexConfigured } from "@/lib/convex";
import { CreditsTrialCard } from "@/components/CreditsTrialCard";
import { useMayaActivation } from "@/hooks/useMayaActivation";
import { trialClock } from "@/lib/credits";
import {
  Bot,
  CalendarDays,
  CreditCard,
  Film,
  Flame,
  FolderOpen,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  MessageSquare,
  Palette,
  Settings,
  Sparkles,
  Video,
  X,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    heading: null,
    items: [
      { label: "Maya", path: "/maya", icon: Sparkles },
      { label: "Dashboard", path: "/", icon: LayoutDashboard },
      { label: "Studio", path: "/studio", icon: Film },
      { label: "Automations", path: "/automations", icon: Bot },
      { label: "Calendar", path: "/calendar", icon: CalendarDays },
      { label: "Library", path: "/posts", icon: FolderOpen },
      { label: "Brand Kit", path: "/brand", icon: Palette },
      { label: "Warmed-Up Accounts", path: "/warmed-up-accounts", icon: Flame, badge: "NEW" },
    ],
  },
  {
    heading: "AI Video",
    items: [
      { label: "My Video", path: "/my-video", icon: Video },
    ],
  },
] as const;

const BOTTOM_NAV = [
  { label: "Pricing", path: "/pricing", icon: CreditCard },
  { label: "Feedback", path: "/feedback", icon: MessageSquare },
  { label: "Settings", path: "/settings", icon: Settings },
] as const;

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
    isActive
      ? "bg-brand/10 text-brand border border-brand/20"
      : "text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent",
  );

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [billingSubscription, setBillingSubscription] = useState<SubscriptionRecord | null>(null);

  const credits = useQuery(api.credits.balance, isConvexConfigured ? {} : "skip");
  const claimTrial = useMutation(api.credits.claimTrial);
  const syncPlan = useMutation(api.credits.syncPlan);
  const mayaActivation = useMayaActivation();

  // Firestore/Dodo is the billing source of truth. Refresh the signed claim
  // used by Convex and use the same record for the sidebar label.
  useEffect(() => {
    if (!user) {
      setBillingSubscription(null);
      return;
    }
    let cancelled = false;
    void getUserSubscription(user.uid)
      .then((subscription) => {
        if (!cancelled) setBillingSubscription(subscription);
      })
      .catch(() => {
        if (!cancelled) setBillingSubscription(null);
      });
    void syncBillingClaims({})
      .then(() => user.getIdToken(true))
      .then(() => (isConvexConfigured ? syncPlan({}) : undefined))
      .catch((error) => console.warn("[billing] claim sync failed", error));
    return () => {
      cancelled = true;
    };
  }, [user, syncPlan]);

  useEffect(() => {
    if (!isConvexConfigured || !credits?.needsTrialClaim) return;
    claimTrial({}).catch(() => {
      /* trial claim is best-effort on layout load */
    });
  }, [credits?.needsTrialClaim, claimTrial]);

  // Close drawer on route change (mobile).
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((name) => name[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  const isCalendarRoute =
    location.pathname === "/calendar" || location.pathname === "/schedule";

  useEffect(() => {
    if (!isCalendarRoute) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isCalendarRoute]);

  const closeSidebar = () => setSidebarOpen(false);
  const billingPaid = billingSubscription
    ? (billingSubscription.plan === "pro" || billingSubscription.plan === "max") &&
      (billingSubscription.status === "active" || billingSubscription.status === undefined)
    : credits?.hasPaidPlan;
  const mayaBillingLocked = billingPaid === false && !!trialClock(credits)?.expired;
  const trackModuleAccess = (module: string, path: string, setupRedirect = false) => {
    captureEvent(PRODUCT_EVENTS.sidebarModuleAccessed, {
      module,
      path,
      setup_redirect: setupRedirect,
    });
    closeSidebar();
  };

  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 sm:h-16 sm:px-5">
        <img
          src="/logo.png"
          alt="Magic Box AI"
          className="h-8 w-8 shrink-0 rounded-lg object-contain sm:h-9 sm:w-9"
        />
        <div className="min-w-0">
          <div className="truncate text-sm font-display text-foreground">Magic Box</div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            AI
          </div>
        </div>
        <button
          type="button"
          className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-accent lg:hidden"
          onClick={closeSidebar}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.heading ?? "main"}>
            {section.heading && (
              <div className="px-3 pb-1 pt-3 text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground/70">
                {section.heading}
              </div>
            )}
            {section.items.map((item) => {
              const mayaLocked = item.path === "/maya" && mayaActivation?.ready !== true;
              const target =
                mayaLocked && mayaActivation?.hasWebsite
                  ? "/onboarding/channels"
                  : mayaLocked
                    ? "/onboarding"
                    : item.path === "/maya" && mayaBillingLocked
                      ? "/pricing?plan=pro"
                    : item.path;
              const itemBadge = "badge" in item ? (item as { badge?: string }).badge : undefined;
              return (
                <NavLink
                  key={item.path}
                  to={target}
                  end={item.path === "/"}
                  onClick={() => trackModuleAccess(item.label, target, mayaLocked)}
                  aria-label={
                    mayaLocked
                      ? `Maya locked. ${mayaActivation?.hasWebsite ? "Connect a social channel" : "Link your website"} to continue.`
                      : mayaBillingLocked && item.path === "/maya"
                        ? "Maya requires an active paid plan."
                      : undefined
                  }
                  className={({ isActive }) =>
                    cn(
                      navLinkClass({ isActive }),
                      (mayaLocked || (mayaBillingLocked && item.path === "/maya")) &&
                        "text-muted-foreground/70",
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {itemBadge && !mayaLocked && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider font-semibold shrink-0">
                      {itemBadge}
                    </span>
                  )}
                  {mayaLocked && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider shrink-0">
                      <LockKeyhole className="h-3 w-3" />
                      Setup
                    </span>
                  )}
                  {!mayaLocked && mayaBillingLocked && item.path === "/maya" && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-destructive/25 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-destructive shrink-0">
                      Paid plan
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-1 border-t border-border px-3 py-2">
        {BOTTOM_NAV.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => trackModuleAccess(item.label, item.path)}
            className={navLinkClass}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </div>

      <div className="shrink-0 space-y-3 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {isConvexConfigured && (
          <CreditsTrialCard
            credits={
              credits && billingSubscription
                ? {
                    ...credits,
                    hasPaidPlan:
                      (billingSubscription.plan === "pro" || billingSubscription.plan === "max") &&
                      (billingSubscription.status === "active" || billingSubscription.status === undefined),
                  }
                : credits
            }
            onNavigate={closeSidebar}
          />
        )}
        <div className="flex items-center gap-2.5">
          <Avatar className="h-9 w-9 shrink-0 border border-border">
            <AvatarImage src={user?.photoURL ?? undefined} />
            <AvatarFallback className="bg-brand/10 text-xs text-brand">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {user?.displayName ?? "User"}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              captureEvent(PRODUCT_EVENTS.logoutCompleted, { source: "sidebar" });
              void signOut();
            }}
            className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 flex h-dvh w-[min(18rem,88vw)] flex-col border-r border-border bg-card transition-transform duration-300 lg:w-64 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {sidebarContent}
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <img
                src="/logo.png"
                alt=""
                className="h-7 w-7 shrink-0 rounded-lg object-contain"
              />
              <span className="truncate text-sm font-display text-foreground">Magic Box AI</span>
            </div>
            {isConvexConfigured && (
              <CreditsTrialCard credits={credits} compact className="mr-1" />
            )}
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={user?.photoURL ?? undefined} />
              <AvatarFallback className="bg-brand/10 text-xs text-brand">{initials}</AvatarFallback>
            </Avatar>
          </div>
        </header>

        <main
          className={cn(
            "mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-5 sm:py-4 md:px-8 lg:py-5",
            isCalendarRoute && "overflow-hidden",
            location.pathname === "/studio" && "h-[calc(100dvh-3.5rem)] lg:h-dvh flex flex-col py-2 px-3 sm:px-6 overflow-hidden max-w-none",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
