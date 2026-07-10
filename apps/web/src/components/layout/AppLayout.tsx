import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@shared/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@shared/components/ui/avatar";
import { Button } from "@shared/components/ui/button";
import { Badge } from "@shared/components/ui/badge";
import { cn } from "@shared/lib/utils";
import {
  BarChart3,
  Bot,
  CalendarDays,
  CreditCard,
  Film,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Megaphone,
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
      { label: "Automations", path: "/automations", icon: Bot },
      { label: "Calendar", path: "/calendar", icon: CalendarDays },
      { label: "Posts", path: "/posts", icon: FolderOpen },
      { label: "Brand Kit", path: "/brand", icon: Palette },
      { label: "Analytics", path: "/analytics", icon: BarChart3 },
    ],
  },
  {
    heading: "Create",
    items: [
      { label: "Content Studio", path: "/content-studio", icon: PenTool },
      { label: "Video Creator", path: "/create-video", icon: Video },
      { label: "Ad Generator", path: "/ad-generator", icon: Megaphone },
      { label: "Avatar Builder", path: "/avatar-builder", icon: User },
      { label: "Avatar Creator", path: "/avatar-creator", icon: Film },
    ],
  },
] as const;

const BOTTOM_NAV = [
  { label: "Pricing", path: "/pricing", icon: CreditCard },
  { label: "Settings", path: "/settings", icon: Settings },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      <div className="flex h-16 items-center gap-3 px-5 border-b border-white/[0.06]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/20">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-white">MagicBox Suite</div>
          <div className="text-[10px] text-white/40">Marketing Automation</div>
        </div>
        <button
          className="ml-auto lg:hidden p-1.5 rounded-lg hover:bg-white/[0.06] text-white/50"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_SECTIONS.map((section) => (
          <div key={section.heading ?? "main"}>
            {section.heading && (
              <div className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-white/25">
                {section.heading}
              </div>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-purple-600/20 text-purple-300 border border-purple-500/20"
                      : "text-white/50 hover:bg-white/[0.06] hover:text-white/80"
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-white/[0.06] px-3 py-3 space-y-1">
        {BOTTOM_NAV.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-purple-600/20 text-purple-300 border border-purple-500/20"
                  : "text-white/50 hover:bg-white/[0.06] hover:text-white/80"
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </div>

      <div className="border-t border-white/[0.06] p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border border-white/10">
            <AvatarImage src={user?.photoURL ?? undefined} />
            <AvatarFallback className="text-xs bg-purple-600/20 text-purple-300">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.displayName ?? "User"}
            </p>
            <p className="text-[10px] text-white/40 truncate">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut()}
            className="shrink-0 h-8 w-8 text-white/40 hover:text-white hover:bg-white/[0.06]"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 border-r border-white/[0.06] bg-zinc-950/95 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-zinc-950/90 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-white/[0.06] text-white/60"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-bold text-white">MagicBox Suite</span>
            </div>
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.photoURL ?? undefined} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </div>
        </header>

        <main className="px-4 py-6 md:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
