import { useState, useEffect } from "react";
import {
  Users,
  Image,
  Megaphone,
  Activity,
  TrendingUp,
  Server,
} from "lucide-react";
import {
  getTotalUsers,
  getTotalInfluencers,
  getTotalAds,
  getTotalApiRequests,
  getRecentUsers,
  getRecentInfluencers,
} from "@shared/lib/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shared/components/ui/table";
import { Badge } from "@shared/components/ui/badge";
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
} from "recharts";

interface StatCard {
  label: string;
  value: number;
  change: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const userGrowthData = [
  { day: "Mon", users: 12 },
  { day: "Tue", users: 19 },
  { day: "Wed", users: 15 },
  { day: "Thu", users: 25 },
  { day: "Fri", users: 32 },
  { day: "Sat", users: 28 },
  { day: "Sun", users: 35 },
];

const apiUsageData = [
  { day: "Mon", requests: 120 },
  { day: "Tue", requests: 190 },
  { day: "Wed", requests: 150 },
  { day: "Thu", requests: 250 },
  { day: "Fri", requests: 320 },
  { day: "Sat", requests: 280 },
  { day: "Sun", requests: 350 },
];

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAvatars: 0,
    totalAds: 0,
    totalApiRequests: 0,
  });
  const [recentUsers, setRecentUsers] = useState<Record<string, unknown>[]>([]);
  const [recentAvatars, setRecentAvatars] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [users, avatars, ads, apiReqs, rUsers, rAvatars] =
          await Promise.all([
            getTotalUsers(),
            getTotalInfluencers(),
            getTotalAds(),
            getTotalApiRequests(),
            getRecentUsers(5),
            getRecentInfluencers(5),
          ]);
        setStats({
          totalUsers: users,
          totalAvatars: avatars,
          totalAds: ads,
          totalApiRequests: apiReqs,
        });
        setRecentUsers(rUsers);
        setRecentAvatars(rAvatars);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const statCards: StatCard[] = [
    {
      label: "Total Users",
      value: stats.totalUsers,
      change: "+12%",
      icon: Users,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
    },
    {
      label: "Total Avatars",
      value: stats.totalAvatars,
      change: "+8%",
      icon: Image,
      color: "text-pink-400",
      bgColor: "bg-pink-500/10",
    },
    {
      label: "Total Ads",
      value: stats.totalAds,
      change: "+23%",
      icon: Megaphone,
      color: "text-indigo-400",
      bgColor: "bg-indigo-500/10",
    },
    {
      label: "API Requests",
      value: stats.totalApiRequests,
      change: "+18%",
      icon: Activity,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
    },
  ];

  function formatTimestamp(ts: unknown): string {
    if (!ts) return "N/A";
    if (typeof ts === "object" && ts !== null && "toDate" in ts) {
      return (ts as { toDate: () => Date }).toDate().toLocaleDateString();
    }
    if (ts instanceof Date) return ts.toLocaleDateString();
    return String(ts);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Dashboard</h1>
          <p className="text-white/50 text-sm mt-1">
            Overview of your MagicBox AI platform
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 glass-card rounded-full">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-xs text-emerald-300 font-medium">
            All Systems Operational
          </span>
          <Server className="w-3.5 h-3.5 text-white/40 ml-1" />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2.5 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                <TrendingUp className="w-3.5 h-3.5" />
                {stat.change}
              </div>
            </div>
            <div>
              {loading ? (
                <div className="h-8 w-20 bg-white/5 rounded animate-pulse" />
              ) : (
                <p className="text-3xl font-bold text-white">
                  {stat.value.toLocaleString()}
                </p>
              )}
              <p className="text-sm text-white/50 mt-1">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">User Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={userGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="day"
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
                  <Line
                    type="monotone"
                    dataKey="users"
                    stroke="#a855f7"
                    strokeWidth={2}
                    dot={{ fill: "#a855f7", r: 4 }}
                    activeDot={{ r: 6, fill: "#c084fc" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">API Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={apiUsageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="day"
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
                  <Bar
                    dataKey="requests"
                    fill="#a855f7"
                    radius={[4, 4, 0, 0]}
                    opacity={0.8}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Users */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Users</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />
                ))}
              </div>
            ) : recentUsers.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-8">
                No users found
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Last Login</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentUsers.map((user, i) => (
                    <TableRow key={(user.id as string) || i}>
                      <TableCell className="font-medium">
                        {(user.displayName as string) || "Unknown"}
                      </TableCell>
                      <TableCell className="text-white/60">
                        {(user.email as string) || "N/A"}
                      </TableCell>
                      <TableCell className="text-white/50 text-xs">
                        {formatTimestamp(user.lastLoginAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Avatars */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Avatars</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />
                ))}
              </div>
            ) : recentAvatars.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-8">
                No avatars found
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentAvatars.map((avatar, i) => (
                    <TableRow key={(avatar.id as string) || i}>
                      <TableCell className="font-medium">
                        {(avatar.name as string) || "Untitled"}
                      </TableCell>
                      <TableCell className="text-white/60 text-xs font-mono">
                        {((avatar.userId as string) || "N/A").slice(0, 12)}...
                      </TableCell>
                      <TableCell className="text-white/50 text-xs">
                        {formatTimestamp(avatar.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
