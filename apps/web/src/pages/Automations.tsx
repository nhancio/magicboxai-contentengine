import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
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
import {
  Bot,
  CalendarClock,
  Instagram,
  Linkedin,
  Loader2,
  Pause,
  Play,
  Plus,
  Trash2,
  Twitter,
  Zap,
} from "lucide-react";

const PLATFORM_ICONS: Record<SocialPlatform, typeof Instagram> = {
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_META: Record<Automation["status"], { label: string; dot: string }> = {
  active: { label: "Active", dot: "bg-emerald-400" },
  paused: { label: "Paused", dot: "bg-amber-400" },
  draft: { label: "Draft", dot: "bg-white/30" },
  error: { label: "Needs attention", dot: "bg-rose-400" },
};

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
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    if (!user) return;
    const list = await getAutomations(user.uid);
    setAutomations(list);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const toggle = async (automation: Automation) => {
    const next = automation.status === "active" ? "paused" : "active";
    setBusy(automation.id);
    try {
      await setAutomationStatus(automation.id, next);
      toast.success(next === "active" ? "Automation resumed" : "Automation paused");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update automation");
    } finally {
      setBusy(null);
    }
  };

  const runNow = async (automation: Automation) => {
    setBusy(automation.id);
    try {
      const result = await runAutomationNow({ automationId: automation.id });
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

  const remove = async (automation: Automation) => {
    if (!confirm(`Delete “${automation.name}”? Scheduled posts already created will remain.`)) return;
    setBusy(automation.id);
    try {
      await deleteAutomation(automation.id);
      await refresh();
      toast.success("Automation deleted");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Automations</h1>
          <p className="mt-1 text-sm text-white/40">
            Prompt-driven engines that write, design, and publish on schedule.
          </p>
        </div>
        <Button asChild className="bg-violet-600 hover:bg-violet-500">
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
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/15">
            <Bot className="h-7 w-7 text-violet-300" />
          </div>
          <div>
            <h2 className="font-semibold">Set up your first automation</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-white/40">
              Give it a brief once — it posts fresh content to your channels every day without you.
            </p>
          </div>
          <Button asChild className="bg-violet-600 hover:bg-violet-500">
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
                      className="truncate font-semibold hover:text-violet-300"
                    >
                      {automation.name}
                    </Link>
                    <span className="text-xs text-white/35">{status.label}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-white/45">{automation.brief}</p>
                  {automation.status === "error" && automation.lastError && (
                    <p className="mt-1 truncate text-xs text-rose-300/80">
                      {automation.lastError}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/40">
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
                    className="border-white/10 bg-white/[0.04]"
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
                    className="h-8 w-8 text-white/50 hover:text-white"
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
                    className="h-8 w-8 text-white/40 hover:text-rose-300"
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
