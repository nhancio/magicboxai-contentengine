import { useState, useEffect, useMemo } from "react";
import { Activity, Search, RefreshCw, Filter } from "lucide-react";
import { getApiLogs, getTotalApiRequests } from "@shared/lib/firestore";
import { Card, CardContent } from "@shared/components/ui/card";
import { Input } from "@shared/components/ui/input";
import { Button } from "@shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shared/components/ui/table";

interface LogEntry {
  id?: string;
  timestamp: unknown;
  method: string;
  endpoint: string;
  statusCode: number;
  duration: number;
  userId?: string;
}

const METHOD_FILTERS = ["ALL", "GET", "POST", "PUT", "DELETE"] as const;
const STATUS_FILTERS = ["ALL", "2xx", "4xx", "5xx"] as const;

function getMethodColor(method: string): string {
  switch (method.toUpperCase()) {
    case "GET": return "border-blue-500/30 bg-blue-500/10 text-blue-300";
    case "POST": return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "PUT": return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
    case "DELETE": return "border-red-500/30 bg-red-500/10 text-red-300";
    default: return "border-white/10 bg-white/5 text-white/70";
  }
}

function getStatusColor(code: number): string {
  if (code >= 200 && code < 300) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (code >= 400 && code < 500) return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  if (code >= 500) return "border-red-500/30 bg-red-500/10 text-red-300";
  return "border-white/10 bg-white/5 text-white/70";
}

function statusInRange(code: number, range: string): boolean {
  if (range === "ALL") return true;
  if (range === "2xx") return code >= 200 && code < 300;
  if (range === "4xx") return code >= 400 && code < 500;
  if (range === "5xx") return code >= 500;
  return true;
}

export default function ApiLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    setLoading(true);
    try {
      const [rawLogs, total] = await Promise.all([
        getApiLogs(100),
        getTotalApiRequests(),
      ]);
      const entries = rawLogs.map((l: Record<string, unknown>) => ({
        id: l.id as string,
        timestamp: l.timestamp,
        method: (l.method as string) || "GET",
        endpoint: (l.endpoint as string) || "/unknown",
        statusCode: (l.statusCode as number) || 200,
        duration: (l.duration as number) || 0,
        userId: l.userId as string | undefined,
      }));

      setLogs(entries);
      setTotalRequests(total);
    } catch (err) {
      console.error("Failed to load API logs:", err);
      setLogs([]);
      setTotalRequests(0);
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (methodFilter !== "ALL" && log.method.toUpperCase() !== methodFilter) return false;
      if (!statusInRange(log.statusCode, statusFilter)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!log.endpoint.toLowerCase().includes(q) && !(log.userId || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [logs, methodFilter, statusFilter, search]);

  function formatTimestamp(ts: unknown): string {
    if (!ts) return "N/A";
    if (typeof ts === "object" && ts !== null && "toDate" in ts) {
      return (ts as { toDate: () => Date }).toDate().toLocaleString();
    }
    if (ts instanceof Date) return ts.toLocaleString();
    return String(ts);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10">
            <Activity className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">API Logs</h1>
            <p className="text-white/50 text-sm">
              {loading ? "Loading..." : `${totalRequests.toLocaleString()} total requests`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-white/40" />
          <span className="text-xs text-white/40 mr-1">Method:</span>
          {METHOD_FILTERS.map((m) => (
            <button
              key={m}
              onClick={() => setMethodFilter(m)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                methodFilter === m
                  ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                  : "text-white/50 hover:text-white/70 hover:bg-white/5 border border-transparent"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-white/40 mr-1">Status:</span>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                statusFilter === s
                  ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                  : "text-white/50 hover:text-white/70 hover:bg-white/5 border border-transparent"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="relative sm:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            placeholder="Search endpoint..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 w-64"
          />
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
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Activity className="w-10 h-10 text-white/20 mb-3" />
              <p className="text-white/50 text-sm">No API logs have been recorded</p>
              <p className="mt-1 max-w-md text-xs text-white/30">
                Production function instrumentation must be connected before this view can report activity.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>User ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log, i) => (
                  <TableRow key={log.id || i}>
                    <TableCell className="text-white/50 text-xs whitespace-nowrap">
                      {formatTimestamp(log.timestamp)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-wider ${getMethodColor(log.method)}`}
                      >
                        {log.method.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-white/80">
                      {log.endpoint}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${getStatusColor(log.statusCode)}`}
                      >
                        {log.statusCode}
                      </span>
                    </TableCell>
                    <TableCell className="text-white/60 text-sm tabular-nums">
                      {log.duration.toLocaleString()}ms
                    </TableCell>
                    <TableCell className="text-white/40 font-mono text-xs">
                      {log.userId ? log.userId.slice(0, 16) : "N/A"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-white/40">
        <span>Showing {filteredLogs.length} of {logs.length} entries</span>
      </div>
    </div>
  );
}
