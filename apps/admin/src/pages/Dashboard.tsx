import { useState, useEffect } from "react";
import {
  Users,
  Megaphone,
  Activity,
} from "lucide-react";
import {
  getTotalUsers,
  getTotalAds,
  getTotalApiRequests,
  getRecentUsers,
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

interface StatCard {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAds: 0,
    totalApiRequests: 0,
  });
  const [recentUsers, setRecentUsers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [users, ads, apiReqs, rUsers] =
          await Promise.all([
            getTotalUsers(),
            getTotalAds(),
            getTotalApiRequests(),
            getRecentUsers(5),
          ]);
        setStats({
          totalUsers: users,
          totalAds: ads,
          totalApiRequests: apiReqs,
        });
        setRecentUsers(rUsers);
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
      icon: Users,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
    },
    {
      label: "Total Ads",
      value: stats.totalAds,
      icon: Megaphone,
      color: "text-indigo-400",
      bgColor: "bg-indigo-500/10",
    },
    {
      label: "API Requests",
      value: stats.totalApiRequests,
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
        <p className="text-xs text-white/40">Counts are read from Firestore; this is not an uptime monitor.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2.5 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
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

      {/* Recent Activity Tables */}
      <div className="grid grid-cols-1 gap-4">
        {/* Recent Users */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Users</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
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
      </div>
    </div>
  );
}
