import { useState } from "react";
import { Button } from "@shared/components/ui/button";
import { Input } from "@shared/components/ui/input";
import { Label } from "@shared/components/ui/label";
import { Textarea } from "@shared/components/ui/textarea";
import { Badge } from "@shared/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@shared/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/components/ui/select";
import {
  Calendar,
  Clock,
  Plus,
  Send,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  Instagram,
  Facebook,
  Youtube,
  Play,
} from "lucide-react";

function getWeekDays(baseDate: Date): Date[] {
  const start = new Date(baseDate);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const PLATFORM_OPTIONS = [
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "facebook", label: "Facebook", icon: Facebook },
  { value: "tiktok", label: "TikTok", icon: Play },
  { value: "youtube", label: "YouTube", icon: Youtube },
];

export default function Schedule() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [selectedContent, setSelectedContent] = useState("");
  const [caption, setCaption] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");

  const today = new Date();
  const baseDate = new Date(today);
  baseDate.setDate(today.getDate() + weekOffset * 7);
  const weekDays = getWeekDays(baseDate);

  const isToday = (d: Date) =>
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  const handleSchedule = () => {
    setDialogOpen(false);
    setSelectedPlatform("");
    setSelectedContent("");
    setCaption("");
    setScheduleDate("");
    setScheduleTime("09:00");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/25">
              <CalendarDays className="h-5 w-5 text-white" />
            </div>
            <span className="text-gradient">Content Schedule</span>
          </h2>
          <p className="mt-2 text-white/60">
            Plan and schedule your content across all platforms.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/25">
              <Plus className="mr-2 h-4 w-4" />
              Schedule New
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-white/[0.06]">
            <DialogHeader>
              <DialogTitle className="text-white">Schedule Content</DialogTitle>
              <DialogDescription className="text-white/50">
                Select content from your library and choose when to publish.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-white/80">Content</Label>
                <Select value={selectedContent} onValueChange={setSelectedContent}>
                  <SelectTrigger className="bg-white/[0.03] border-white/[0.06]">
                    <SelectValue placeholder="Select from library..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="placeholder-1">Sample Ad - Summer Collection</SelectItem>
                    <SelectItem value="placeholder-2">Avatar Post - Brand Ambassador</SelectItem>
                    <SelectItem value="placeholder-3">Product Showcase - New Arrivals</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white/80">Date</Label>
                  <Input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="bg-white/[0.03] border-white/[0.06]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Time</Label>
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="bg-white/[0.03] border-white/[0.06]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white/80">Platform</Label>
                <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                  <SelectTrigger className="bg-white/[0.03] border-white/[0.06]">
                    <SelectValue placeholder="Select platform..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-white/80">Caption</Label>
                <Textarea
                  placeholder="Write your post caption..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={3}
                  className="bg-white/[0.03] border-white/[0.06] resize-none"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                className="text-white/60"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSchedule}
                className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
              >
                <Send className="mr-2 h-4 w-4" />
                Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Scheduled This Week", value: "0", icon: Calendar, color: "purple" },
          { label: "Published", value: "0", icon: Send, color: "green" },
          { label: "Drafts", value: "0", icon: FileText, color: "amber" },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-5 flex items-center gap-4">
            <div
              className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                stat.color === "purple"
                  ? "bg-purple-500/20"
                  : stat.color === "green"
                    ? "bg-green-500/20"
                    : "bg-amber-500/20"
              }`}
            >
              <stat.icon
                className={`h-6 w-6 ${
                  stat.color === "purple"
                    ? "text-purple-400"
                    : stat.color === "green"
                      ? "text-green-400"
                      : "text-amber-400"
                }`}
              />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-sm text-white/50">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Calendar Week Header */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/60 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h3 className="text-lg font-semibold text-white">
            {MONTH_NAMES[weekDays[0].getMonth()]} {weekDays[0].getFullYear()}
          </h3>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/60 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, i) => (
            <div
              key={i}
              className={`rounded-xl p-3 text-center transition-colors ${
                isToday(day)
                  ? "bg-purple-600/20 border border-purple-500/30"
                  : "bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04]"
              }`}
            >
              <p className="text-xs text-white/40 font-medium">{DAY_NAMES[i]}</p>
              <p
                className={`text-lg font-bold mt-1 ${
                  isToday(day) ? "text-purple-300" : "text-white/80"
                }`}
              >
                {day.getDate()}
              </p>
              {isToday(day) && (
                <Badge className="mt-1 bg-purple-500/30 text-purple-300 border-purple-500/40 text-[10px]">
                  Today
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Timeline / Empty State */}
      <div className="glass-card p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="h-20 w-20 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
            <Clock className="h-10 w-10 text-white/20" />
          </div>
          <p className="text-lg font-medium text-white/60">No scheduled posts</p>
          <p className="text-sm text-white/40 mt-1 max-w-sm">
            Plan your content calendar! Click "Schedule New" to start organizing your posts across platforms.
          </p>
          <Button
            onClick={() => setDialogOpen(true)}
            className="mt-6 bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/25"
          >
            <Plus className="mr-2 h-4 w-4" />
            Schedule Your First Post
          </Button>
        </div>
      </div>
    </div>
  );
}
