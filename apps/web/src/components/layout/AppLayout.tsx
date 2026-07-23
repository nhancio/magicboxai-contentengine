import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@shared/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/avatar";
import { Button } from "@shared/components/ui/button";
import { cn } from "@shared/lib/utils";
import { api } from "@convex/_generated/api";
import { isConvexConfigured } from "@/lib/convex";
import { LEGACY_TOOLS_ENABLED } from "@/lib/flags";
import { CreditsTrialCard } from "@/components/CreditsTrialCard";
import {
  BarChart3,
  Bot,
  CalendarDays,
  CreditCard,
  Film,
  FolderOpen,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Palette,
  PenTool,
  Settings,
  Sparkles,
  User,
  Video,
  X,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    heading: null,
    items: [
      { label: "Dashboard", path: "/", icon: LayoutDashboard },
      { label: "Maya", path: "/maya", icon: Sparkles },
      { label: "Automations", path: "/automations", icon: Bot },
      { label: "Calendar", path: "/calendar", icon: CalendarDays },
      { label: "Posts", path: "/posts", icon: FolderOpen },
      { label: "Brand Kit", path: "/brand", icon: Palette },
      { label: "Analytics", path: "/analytics", icon: BarChart3 },
    ],
  },
  {
    heading: "AI Video",
    items: [
      { label: "Avatar", path: "/avatars", icon: User },
      { label: "Studio", path: "/studio", icon: Film },
      { label: "Carousel", path: "/carousel", icon: Layers },
    ],
  },
  ...(LEGACY_TOOLS_ENABLED
    ? [
        {
          heading: "Create",
          items: [
            { label: "Content Studio", path: "/content-studio", icon: PenTool },
            { label: "Video Creator", path: "/create-video", icon: Video },
          ],
        },
      ]
    : []),
] as const;

const BOTTOM_NAV = [
  { label: "Pricing", path: "/pricing", icon: CreditCard },
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

  const credits = useQuery(api.credits.balance, isConvexConfigured ? {} : "skip");
  const claimTrial = useMutation(api.credits.claimTrial);

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

  const closeSidebar = () => setSidebarOpen(false);

  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 sm:h-16 sm:px-5">
        <img
          src="/logo.png"
          alt="MagicBox"
          className="h-8 w-8 shrink-0 rounded-lg object-contain sm:h-9 sm:w-9"
        />
        <div className="min-w-0">
          <div className="truncate text-sm font-display text-foreground">MagicBox</div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Automation
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
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                onClick={closeSidebar}
                className={navLinkClass}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-1 border-t border-border px-3 py-2">
        {BOTTOM_NAV.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={closeSidebar}
            className={navLinkClass}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </div>

      <div className="shrink-0 space-y-3 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {isConvexConfigured && (
          <CreditsTrialCard credits={credits} onNavigate={closeSidebar} />
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
            onClick={() => signOut()}
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
              <span className="truncate text-sm font-display text-foreground">MagicBox</span>
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

        <main className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-5 sm:py-6 md:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
