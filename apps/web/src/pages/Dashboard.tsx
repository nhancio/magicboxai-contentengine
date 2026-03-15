import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@shared/lib/auth";
import { getInfluencers, getAds } from "@shared/lib/firestore";
import { Card, CardContent } from "@shared/components/ui/card";
import { Button } from "@shared/components/ui/button";
import {
  Wand2,
  Palette,
  Megaphone,
  Image,
  Sparkles,
  TrendingUp,
  Clock,
  ArrowRight,
} from "lucide-react";

interface StatCard {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bg: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [avatarCount, setAvatarCount] = useState(0);
  const [adCount, setAdCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    getInfluencers(user.uid)
      .then((list) => setAvatarCount(list.length))
      .catch(() => setAvatarCount(0));
    getAds(user.uid)
      .then((list) => setAdCount(list.length))
      .catch(() => setAdCount(0));
  }, [user]);

  const stats: StatCard[] = [
    {
      label: "My Avatars",
      value: avatarCount,
      icon: Sparkles,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      label: "My Ads",
      value: adCount,
      icon: Megaphone,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
    },
    {
      label: "Content Created",
      value: avatarCount + adCount,
      icon: Image,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
    },
    {
      label: "API Credits",
      value: 500,
      icon: TrendingUp,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
  ];

  const quickActions = [
    {
      title: "Create Avatar",
      description: "Design a unique AI-generated avatar",
      icon: Wand2,
      href: "/avatar-builder",
      gradient: "from-purple-500 to-indigo-600",
    },
    {
      title: "Content Studio",
      description: "Create social media posts with AI",
      icon: Palette,
      href: "/content-studio",
      gradient: "from-violet-500 to-purple-600",
    },
    {
      title: "Generate Ad",
      description: "Build high-converting ad creatives",
      icon: Megaphone,
      href: "/ad-generator",
      gradient: "from-indigo-500 to-blue-600",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Banner */}
      <div className="glass-card p-6 md:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl md:text-3xl font-bold font-display">
            Welcome back,{" "}
            <span className="text-gradient">
              {user?.displayName ?? "Creator"}
            </span>
          </h1>
          <p className="text-white/60 text-sm md:text-base">
            Here's what's happening with your AI content today.
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="glass-card border-white/[0.06]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-white/60">{stat.label}</p>
                  <p className="text-2xl font-bold font-display text-white">
                    {stat.value}
                  </p>
                </div>
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.bg}`}
                >
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold font-display text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <Link key={action.href} to={action.href} className="group">
              <Card className="glass-card border-white/[0.06] transition-all duration-300 hover:bg-white/[0.06] hover:border-white/[0.1] h-full">
                <CardContent className="p-6 flex flex-col gap-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${action.gradient} shadow-lg shadow-purple-500/20`}
                  >
                    <action.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                      {action.title}
                    </h3>
                    <p className="text-sm text-white/50">
                      {action.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Get started
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold font-display text-white mb-4">
          Recent Activity
        </h2>
        <Card className="glass-card border-white/[0.06]">
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center text-center gap-3 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5">
                <Clock className="h-6 w-6 text-white/30" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-white/60">
                  No recent activity
                </p>
                <p className="text-xs text-white/40">
                  Start creating avatars and content to see your activity here
                </p>
              </div>
              <Link to="/avatar-builder">
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                >
                  Create your first avatar
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
