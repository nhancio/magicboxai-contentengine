import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@shared/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/avatar";
import { Button } from "@shared/components/ui/button";
import { cn } from "@shared/lib/utils";
import { api } from "@convex/_generated/api";
import { isConvexConfigured } from "@/lib/convex";
import { LEGACY_TOOLS_ENABLED } from "@/lib/flags";
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
      : "text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent"
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

  void location;

  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((name) => name[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 px-5 border-b border-border">
        <img src="/logo.png" alt="MagicBox" className="h-9 w-9 shrink-0 rounded-lg object-contain" />
        <div className="min-w-0">
          <div className="truncate text-sm font-display text-foreground">MagicBox</div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Automation</div>
        </div>
        <button
          className="ml-auto lg:hidden p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_SECTIONS.map((section) => (
          <div key={section.heading ?? "main"}>
            {section.heading && (
              <div className="px-3 pb-1 pt-4 text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground/70">
                {section.heading}
              </div>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                onClick={() => setSidebarOpen(false)}
                className={navLinkClass}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-3 py-3 space-y-1">
        {BOTTOM_NAV.map((item) => (
          <NavLink key={item.path} to={item.path} onClick={() => setSidebarOpen(false)} className={navLinkClass}>
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </div>

      <div className="border-t border-border p-4 space-y-3">
        {isConvexConfigured && (
          <Link
            to="/pricing"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/60 px-2.5 py-2 text-[11px] transition-colors hover:border-brand/30 hover:bg-secondary"
            title="View credits & pricing"
          >
            <span className="font-medium text-muted-foreground">Credits</span>
            <span className="flex items-center gap-2 tabular-nums text-foreground">
              <span>
                <span className="text-brand">{credits?.iCredits ?? "—"}</span>
                <span className="text-muted-foreground"> i</span>
              </span>
              <span className="text-border">·</span>
              <span>
                <span className="text-brand">{credits?.vCredits ?? "—"}</span>
                <span className="text-muted-foreground"> v</span>
              </span>
            </span>
          </Link>
        )}
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border border-border">
            <AvatarImage src={user?.photoURL ?? undefined} />
            <AvatarFallback className="text-xs bg-brand/10 text-brand">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.displayName ?? "User"}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut()}
            className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
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
        <div className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 border-r border-border bg-card transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground">
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="MagicBox" className="h-8 w-8 rounded-lg object-contain" />
              <span className="text-sm font-display text-foreground">MagicBox</span>
            </div>
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.photoURL ?? undefined} />
              <AvatarFallback className="text-xs bg-brand/10 text-brand">{initials}</AvatarFallback>
            </Avatar>
          </div>
        </header>

        <main className="px-4 py-6 md:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
