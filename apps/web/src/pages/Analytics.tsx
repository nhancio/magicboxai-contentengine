import { useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Badge } from "@shared/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shared/components/ui/table";
import { cn } from "@shared/lib/utils";
import {
  BarChart3,
  Eye,
  TrendingUp,
  FileText,
  Award,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

const DATE_RANGES = ["This Week", "This Month", "Last 30 Days", "All Time"] as const;

const performanceData = [
  { date: "Mon", views: 1240, engagement: 320 },
  { date: "Tue", views: 1580, engagement: 420 },
  { date: "Wed", views: 980, engagement: 280 },
  { date: "Thu", views: 2100, engagement: 560 },
  { date: "Fri", views: 1860, engagement: 490 },
  { date: "Sat", views: 2400, engagement: 620 },
  { date: "Sun", views: 1720, engagement: 380 },
];

const platformData = [
  { platform: "Instagram", posts: 12 },
  { platform: "Facebook", posts: 8 },
  { platform: "TikTok", posts: 15 },
  { platform: "YouTube", posts: 5 },
  { platform: "Google", posts: 3 },
];

const recentPerformance = [
  { content: "Summer Collection Ad", platform: "Instagram", views: "2.4K", engagement: "8.2%", date: "Mar 10" },
  { content: "Brand Ambassador Post", platform: "TikTok", views: "5.1K", engagement: "12.5%", date: "Mar 9" },
  { content: "Product Showcase", platform: "Facebook", views: "1.2K", engagement: "4.8%", date: "Mar 8" },
  { content: "Tutorial Video", platform: "YouTube", views: "890", engagement: "6.1%", date: "Mar 7" },
  { content: "Flash Sale Banner", platform: "Google", views: "3.3K", engagement: "3.2%", date: "Mar 6" },
];

const stats = [
  {
    label: "Total Views",
    value: "24.8K",
    change: "+12.5%",
    up: true,
    icon: Eye,
    color: "purple",
  },
  {
    label: "Engagement Rate",
    value: "6.8%",
    change: "+2.1%",
    up: true,
    icon: TrendingUp,
    color: "indigo",
  },
  {
    label: "Content Created",
    value: "43",
    change: "+8",
    up: true,
    icon: FileText,
    color: "violet",
  },
  {
    label: "Best Platform",
    value: "TikTok",
    change: "12.5% eng.",
    up: true,
    icon: Award,
    color: "fuchsia",
  },
];

const colorMap: Record<string, { bg: string; icon: string }> = {
  purple: { bg: "bg-purple-500/20", icon: "text-purple-400" },
  indigo: { bg: "bg-indigo-500/20", icon: "text-indigo-400" },
  violet: { bg: "bg-violet-500/20", icon: "text-violet-400" },
  fuchsia: { bg: "bg-fuchsia-500/20", icon: "text-fuchsia-400" },
};

const platformColors: Record<string, string> = {
  Instagram: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  Facebook: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  TikTok: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  YouTube: "bg-red-500/20 text-red-300 border-red-500/30",
  Google: "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

export default function Analytics() {
  const [dateRange, setDateRange] = useState<string>("This Week");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/25">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <span className="text-gradient">Analytics</span>
          </h2>
          <p className="mt-2 text-white/60">
            Track your content performance and audience engagement.
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex flex-wrap gap-2">
          {DATE_RANGES.map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                dateRange === range
                  ? "bg-purple-600/30 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/20"
                  : "bg-white/[0.03] text-white/60 border border-white/[0.06] hover:bg-white/[0.06] hover:text-white/80"
              )}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const colors = colorMap[stat.color];
          return (
            <div key={stat.label} className="glass-card p-5">
              <div className="flex items-start justify-between">
                <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center", colors.bg)}>
                  <stat.icon className={cn("h-5 w-5", colors.icon)} />
                </div>
                <div
                  className={cn(
                    "flex items-center gap-1 text-xs font-medium",
                    stat.up ? "text-green-400" : "text-red-400"
                  )}
                >
                  {stat.up ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  )}
                  {stat.change}
                </div>
              </div>
              <p className="mt-4 text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-sm text-white/50">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Content Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.3)"
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.3)"
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "rgba(24,24,27,0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              />
              <Legend wrapperStyle={{ color: "rgba(255,255,255,0.6)" }} />
              <Line
                type="monotone"
                dataKey="views"
                stroke="#a855f7"
                strokeWidth={2}
                dot={{ fill: "#a855f7", r: 4 }}
                activeDot={{ r: 6, fill: "#a855f7" }}
              />
              <Line
                type="monotone"
                dataKey="engagement"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ fill: "#6366f1", r: 4 }}
                activeDot={{ r: 6, fill: "#6366f1" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Platform Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={platformData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="platform"
                stroke="rgba(255,255,255,0.3)"
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.3)"
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "rgba(24,24,27,0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              />
              <Bar dataKey="posts" radius={[6, 6, 0, 0]} fill="#a855f7" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Performance Table */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Performance</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-white/50">Content</TableHead>
                <TableHead className="text-white/50">Platform</TableHead>
                <TableHead className="text-white/50">Views</TableHead>
                <TableHead className="text-white/50">Engagement</TableHead>
                <TableHead className="text-white/50">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentPerformance.map((row, i) => (
                <TableRow key={i} className="border-white/[0.06]">
                  <TableCell className="font-medium text-white">{row.content}</TableCell>
                  <TableCell>
                    <Badge className={cn("text-xs", platformColors[row.platform])}>
                      {row.platform}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-white/70">{row.views}</TableCell>
                  <TableCell className="text-white/70">{row.engagement}</TableCell>
                  <TableCell className="text-white/50">{row.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
