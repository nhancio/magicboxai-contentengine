import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAction, useMutation, useQuery } from "convex/react";
import { useAuth } from "@shared/lib/auth";
import type { Automation, SocialPlatform } from "@shared/types";
import {
  getAutomations,
  setAutomationStatus,
  deleteAutomation,
} from "@shared/lib/automations";
import { runAutomationNow } from "@shared/lib/suite";
import { Button } from "@shared/components/ui/button";
import { cn } from "@shared/lib/utils";
import { api } from "@convex/_generated/api";
import { isConvexConfigured } from "../lib/convex";
import {
  Bot,
  CalendarClock,
  Globe2,
  Instagram,
  Linkedin,
  Loader2,
  Pause,
  Play,
  Plus,
  Trash2,
  Twitter,
  MessageCircle,
  Youtube,
  Zap,
} from "lucide-react";

const PLATFORM_ICONS: Record<SocialPlatform, typeof Instagram> = {
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
  youtube: Youtube,
  facebook: Globe2,
  whatsapp: MessageCircle,
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_META: Record<Automation["status"], { label: string; dot: string }> = {
  active: { label: "Active", dot: "bg-emerald-500" },
  paused: { label: "Paused", dot: "bg-amber-500" },
  draft: { label: "Draft", dot: "bg-muted-foreground/40" },
  error: { label: "Needs attention", dot: "bg-red-500" },
};

type UiAutomation = Automation & { store: "convex" | "firebase" };

function fromConvexRow(row: {
  _id: string;
  userId: string;
  brandProfileId?: string;
  name: string;
  status: Automation["status"];
  brief: string;
  platforms: SocialPlatform[];
  socialAccountIds: string[];
  contentTypes: { text: boolean; image: boolean; video: boolean };
  preset: string;
  tone?: string;
  schedule: {
    type: "recurring" | "once";
    time: string;
    daysOfWeek?: number[];
    timezone: string;
    endAt?: number;
  };
  nextRunAt: number;
  lastRunAt?: number;
  runCount: number;
  failureCount: number;
  lastError?: string;
  generateLeadMinutes: number;
  requiresApproval: boolean;
  createdAt: number;
  updatedAt?: number;
}): UiAutomation {
  return {
    id: String(row._id),
    userId: row.userId,
    brandProfileId: row.brandProfileId,
    name: row.name,
    status: row.status,
    brief: row.brief,
    platforms: row.platforms,
    socialAccountIds: row.socialAccountIds,
    contentTypes: row.contentTypes,
    preset: (row.preset as Automation["preset"]) || "custom",
    tone: row.tone ?? "",
    schedule: {
      type: row.schedule.type,
      time: row.schedule.time,
      daysOfWeek: row.schedule.daysOfWeek,
      timezone: row.schedule.timezone,
      endAt: row.schedule.endAt ? new Date(row.schedule.endAt) : undefined,
    },
    nextRunAt: new Date(row.nextRunAt),
    lastRunAt: row.lastRunAt ? new Date(row.lastRunAt) : undefined,
    runCount: row.runCount,
    failureCount: row.failureCount,
    lastError: row.lastError,
    generateLeadMinutes: row.generateLeadMinutes,
    requiresApproval: row.requiresApproval,
    createdAt: new Date(row.createdAt),
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
    store: "convex",
  };
}

function scheduleLabel(automation: Automation): string {
  const days = automation.schedule.daysOfWeek;
  const dayPart =
    !days || days.length === 0 || days.length === 7
      ? "Daily"
      : days.map((d) => DAYS[d]).join(", ");
  return `${dayPart} at ${automation.schedule.time}`;
}

export default function Automations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [legacyAutomations, setLegacyAutomations] = useState<Automation[]>([]);
  const [legacyLoading, setLegacyLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const convexRows = useQuery(api.automations.list, isConvexConfigured ? {} : "skip");
  const setStatusConvex = useMutation(api.automations.setStatus);
  const removeConvex = useMutation(api.automations.remove);
  const runNowConvex = useAction(api.automations.runNow);

  const refreshLegacy = async () => {
    if (!user) return;
    const list = await getAutomations(user.uid);
    setLegacyAutomations(list);
    setLegacyLoading(false);
  };

  useEffect(() => {
    refreshLegacy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const automations = useMemo<UiAutomation[]>(() => {
    const fromConvex = (convexRows ?? []).map((row) =>
      fromConvexRow({
        ...row,
        _id: String(row._id),
        platforms: row.platforms as SocialPlatform[],
        preset: String(row.preset),
      }),
    );
    const seen = new Set(fromConvex.map((row) => row.id));
    const fromLegacy = legacyAutomations
      .filter((row) => !seen.has(row.id))
      .map((row) => ({ ...row, store: "firebase" as const }));
    return [...fromConvex, ...fromLegacy];
  }, [convexRows, legacyAutomations]);

  const loading =
    legacyLoading || (isConvexConfigured && convexRows === undefined);

  const toggle = async (automation: UiAutomation) => {
    const next = automation.status === "active" ? "paused" : "active";
    setBusy(automation.id);
    try {
      if (automation.store === "convex") {
        await setStatusConvex({ automationId: automation.id, status: next });
      } else {
        await setAutomationStatus(automation.id, next);
        await refreshLegacy();
      }
      toast.success(next === "active" ? "Automation resumed" : "Automation paused");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update automation");
    } finally {
      setBusy(null);
    }
  };

  const runNow = async (automation: UiAutomation) => {
    setBusy(automation.id);
    try {
      const result =
        automation.store === "convex"
          ? await runNowConvex({ automationId: automation.id })
          : await runAutomationNow({ automationId: automation.id });
      toast.success(
        result.status === "pending_approval"
          ? "Post generated — waiting for your approval"
          : "Post generated — publishing within a minute",
        { action: { label: "View posts", onClick: () => navigate("/posts") } }
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Run failed");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (automation: UiAutomation) => {
    if (!confirm(`Delete “${automation.name}”? Scheduled posts already created will remain.`)) return;
    setBusy(automation.id);
    try {
      if (automation.store === "convex") {
        await removeConvex({ automationId: automation.id });
      } else {
        await deleteAutomation(automation.id);
        await refreshLegacy();
      }
      toast.success("Automation deleted");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <span className="eyebrow">MagicBox</span>
          <h1 className="mt-2 font-display text-4xl leading-none text-foreground">Automations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Prompt-driven engines that write, design, and publish on schedule.
          </p>
        </div>
        <Button asChild>
          <Link to="/automations/new">
            <Plus className="mr-1.5 h-4 w-4" /> New automation
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-card h-24 animate-pulse" />
          ))}
        </div>
      ) : automations.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-brand/10">
            <Bot className="h-7 w-7 text-brand" />
          </div>
          <div>
            <h2 className="font-display text-2xl text-foreground">Set up your first automation</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Give it a brief once — it posts fresh content to your channels every day without you.
            </p>
          </div>
          <Button asChild>
            <Link to="/automations/new">
              <Plus className="mr-1.5 h-4 w-4" /> Create automation
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map((automation, i) => {
            const status = STATUS_META[automation.status];
            return (
              <motion.div
                key={automation.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.15 }}
                className="glass-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className={cn("h-2 w-2 rounded-full", status.dot)} />
                    <Link
                      to={`/automations/${automation.id}`}
                      className="truncate font-semibold text-foreground hover:text-brand"
                    >
                      {automation.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">{status.label}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{automation.brief}</p>
                  {automation.status === "error" && automation.lastError && (
                    <p className="mt-1 truncate text-xs text-red-600">
                      {automation.lastError}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {scheduleLabel(automation)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {automation.platforms.map((p) => {
                        const Icon = PLATFORM_ICONS[p];
                        return Icon ? <Icon key={p} className="h-3.5 w-3.5" /> : null;
                      })}
                    </span>
                    <span>{automation.runCount} runs</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy === automation.id}
                    onClick={() => runNow(automation)}
                    title="Generate and publish a post right now"
                  >
                    {busy === automation.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Zap className="h-3.5 w-3.5" />
                    )}
                    <span className="ml-1.5 hidden sm:inline">Run now</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busy === automation.id || automation.status === "draft"}
                    onClick={() => toggle(automation)}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title={automation.status === "active" ? "Pause" : "Resume"}
                  >
                    {automation.status === "active" ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busy === automation.id}
                    onClick={() => remove(automation)}
                    className="h-8 w-8 text-muted-foreground hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
