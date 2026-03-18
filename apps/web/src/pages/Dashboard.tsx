import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@shared/lib/auth";
import { getInfluencers, getAds } from "@shared/lib/firestore";
import { PREBUILT_AVATARS } from "@shared/lib/avatars";
import { VIRAL_TEMPLATES } from "@shared/lib/templates";
import { Card, CardContent } from "@shared/components/ui/card";
import { Button } from "@shared/components/ui/button";
import { Badge } from "@shared/components/ui/badge";
import {
  Video,
  Wand2,
  Sparkles,
  TrendingUp,
  Clock,
  ArrowRight,
  Play,
  Zap,
  Users,
  Layout,
} from "lucide-react";

interface StatCard {
  label: string;
  value: number | string;
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
      label: "Videos Created",
      value: adCount,
      icon: Video,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      label: "My Avatars",
      value: avatarCount,
      icon: Users,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
    },
    {
      label: "Templates Available",
      value: VIRAL_TEMPLATES.length,
      icon: Layout,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
    },
    {
      label: "Free Credits Left",
      value: "10",
      icon: TrendingUp,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Banner + CTA */}
      <div className="glass-card p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 mb-2">
              <Zap className="w-3 h-3 mr-1" />
              FREE During Launch
            </Badge>
            <h1 className="text-2xl md:text-3xl font-bold font-display">
              Welcome back,{" "}
              <span className="text-gradient">
                {user?.displayName ?? "Creator"}
              </span>
            </h1>
            <p className="text-white/60 text-sm md:text-base max-w-lg">
              Create viral UGC videos with AI avatars and proven templates. Select an avatar, pick a template, and generate scroll-stopping content in seconds.
            </p>
          </div>
          <Link to="/create-video">
            <Button className="h-12 px-8 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-semibold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all whitespace-nowrap">
              <Video className="h-5 w-5 mr-2" />
              Create Video
            </Button>
          </Link>
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

      {/* Quick Start - Create Video */}
      <div>
        <h2 className="text-lg font-semibold font-display text-white mb-4">
          Quick Start
        </h2>
        <Link to="/create-video" className="block group">
          <Card className="glass-card border-white/[0.06] transition-all duration-300 hover:bg-white/[0.06] hover:border-purple-500/30 overflow-hidden">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/25 shrink-0 group-hover:scale-110 transition-transform">
                  <Play className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-xl font-bold text-white group-hover:text-purple-300 transition-colors">
                    Create Your First UGC Video
                  </h3>
                  <p className="text-white/50 text-sm max-w-xl">
                    Pick an AI avatar, choose a viral template, add your product details, and let AI generate a scroll-stopping UGC video. It takes less than 60 seconds.
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <Badge variant="secondary" className="bg-white/5 text-white/40 border-white/10 text-xs">
                      3 easy steps
                    </Badge>
                    <Badge variant="secondary" className="bg-white/5 text-white/40 border-white/10 text-xs">
                      AI-powered scripts
                    </Badge>
                    <Badge variant="secondary" className="bg-white/5 text-white/40 border-white/10 text-xs">
                      8 avatars
                    </Badge>
                  </div>
                </div>
                <ArrowRight className="h-6 w-6 text-white/30 group-hover:text-purple-400 transition-colors shrink-0 hidden md:block" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Featured Avatars */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold font-display text-white">
            AI Avatars
          </h2>
          <Link to="/create-video" className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PREBUILT_AVATARS.slice(0, 4).map((avatar) => (
            <Link key={avatar.id} to="/create-video">
              <Card className="glass-card border-white/[0.06] transition-all duration-300 hover:bg-white/[0.06] hover:border-white/[0.1] cursor-pointer group h-full">
                <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${avatar.gradient} text-xl font-bold text-white shadow-lg group-hover:scale-110 transition-transform`}
                  >
                    {avatar.emoji}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-white">{avatar.name}</p>
                    <p className="text-xs text-white/40">{avatar.personality}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Popular Templates */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold font-display text-white">
            Popular Templates
          </h2>
          <Link to="/create-video" className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: "Problem → Solution", hook: "I was struggling with [X] until I found THIS", gradient: "from-purple-500 to-indigo-600", category: "Conversion" },
            { name: "3 Reasons Why", hook: "3 reasons why [product] is going viral right now", gradient: "from-indigo-500 to-blue-600", category: "Educational" },
            { name: "Before & After", hook: "Before vs. after using [product] for 30 days", gradient: "from-violet-500 to-purple-600", category: "Transformation" },
          ].map((template) => (
            <Link key={template.name} to="/create-video" className="group">
              <Card className="glass-card border-white/[0.06] transition-all duration-300 hover:bg-white/[0.06] hover:border-white/[0.1] h-full">
                <CardContent className="p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${template.gradient} shadow-lg`}>
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm group-hover:text-purple-300 transition-colors">
                        {template.name}
                      </h3>
                      <Badge variant="secondary" className="bg-white/5 text-white/40 border-white/10 text-[10px] mt-0.5">
                        {template.category}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-white/40 italic">"{template.hook}"</p>
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
                  No videos created yet
                </p>
                <p className="text-xs text-white/40">
                  Create your first viral UGC video to see your activity here
                </p>
              </div>
              <Link to="/create-video">
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                >
                  Create your first video
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
