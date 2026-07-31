import { useState, useEffect, useMemo } from "react";
import { Users as UsersIcon, Search, Download } from "lucide-react";
import { getRecentUsers } from "@shared/lib/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/card";
import { Input } from "@shared/components/ui/input";
import { Button } from "@shared/components/ui/button";
import { Badge } from "@shared/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shared/components/ui/table";

export default function Users() {
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await getRecentUsers(50);
        setUsers(data);
      } catch (err) {
        console.error("Failed to load users:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        ((u.displayName as string) || "").toLowerCase().includes(q) ||
        ((u.email as string) || "").toLowerCase().includes(q)
    );
  }, [users, search]);

  function formatTimestamp(ts: unknown): string {
    if (!ts) return "N/A";
    if (typeof ts === "object" && ts !== null && "toDate" in ts) {
      return (ts as { toDate: () => Date }).toDate().toLocaleDateString();
    }
    if (ts instanceof Date) return ts.toLocaleDateString();
    return String(ts);
  }

  function isActive(ts: unknown): boolean {
    if (!ts) return false;
    let date: Date | null = null;
    if (typeof ts === "object" && ts !== null && "toDate" in ts) {
      date = (ts as { toDate: () => Date }).toDate();
    } else if (ts instanceof Date) {
      date = ts;
    }
    if (!date) return false;
    const daysSince = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince < 30;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-500/10">
            <UsersIcon className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Users</h1>
            <p className="text-white/50 text-sm">
              {loading ? "Loading..." : `${users.length} total users`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4" />
            Export Users
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-white/5 rounded animate-pulse" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <UsersIcon className="w-10 h-10 text-white/20 mb-3" />
              <p className="text-white/50 text-sm">
                {search ? "No users match your search" : "No users found"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Avatars Created</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user, i) => {
                  const active = isActive(user.lastLoginAt);
                  return (
                    <TableRow key={(user.id as string) || i}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {((user.displayName as string) || "U")
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <span className="font-medium text-white">
                            {(user.displayName as string) || "Unknown"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-white/60">
                        {(user.email as string) || "N/A"}
                      </TableCell>
                      <TableCell className="text-white/50 text-xs">
                        {formatTimestamp(user.lastLoginAt)}
                      </TableCell>
                      <TableCell className="text-white/40">&mdash;</TableCell>
                      <TableCell>
                        <Badge variant={active ? "success" : "secondary"}>
                          {active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination Placeholder */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/40">
          Showing {filteredUsers.length} of {users.length} users
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
