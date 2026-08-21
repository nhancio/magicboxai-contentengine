import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent } from "@shared/components/ui/card";
import { Button } from "@shared/components/ui/button";
import { Label } from "@shared/components/ui/label";
import { Textarea } from "@shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/components/ui/select";
import {
  Route,
  FileText,
  MessageSquarePlus,
  Bot,
  ArrowUpRight,
  Upload,
  Loader2,
} from "lucide-react";
import { useAuth } from "@shared/lib/auth";

export default function Feedback() {
  const { user } = useAuth();
  const [category, setCategory] = useState("general");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;

    setIsSubmitting(true);
    try {
      const webhookUrl = import.meta.env.VITE_FEEDBACK_WEBHOOK_URL;
      console.log("Feedback submitting to:", webhookUrl);
      if (!webhookUrl) {
        // Fallback mockup if no URL configured
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.warn("No VITE_FEEDBACK_WEBHOOK_URL set. Mocking submission.");
      } else {
        await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            category,
            feedback,
            userEmail: user?.email ?? "anonymous",
            userName: user?.displayName ?? "Anonymous",
            timestamp: new Date().toISOString(),
          }),
          mode: "no-cors", // Necessary to avoid CORS issues with simple Apps Script deployments
        });
      }

      toast.success("Feedback submitted successfully. Thank you!");
      setFeedback("");
      setCategory("general");
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit feedback. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full animate-fade-in py-8">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <div className="mb-10 text-center sm:text-left">
          <h1 className="font-display text-3xl font-bold text-foreground">Feedback</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Share your thoughts, report bugs, or request features
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <a
            href="https://roadmap.magicboxai.in" // Replace with actual roadmap link
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary/50"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                <Route className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground">View our roadmap</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  See what we're building, vote on features, and request new ones
                </p>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </a>

          <Link
            to="/changelog"
            className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary/50"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-foreground">Changelog</h3>
                  <span className="rounded bg-brand/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-brand">v1.0</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  See what's new and what we've shipped in MagicBox 1.0
                </p>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        </div>

        <Card className="glass-card shadow-sm border border-border">
          <CardContent className="p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <MessageSquarePlus className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Share Your Feedback</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">We read every submission</p>
              </div>
            </div>

            <div className="mb-8 rounded-lg border border-orange-500/20 bg-orange-500/5 p-4 text-xs leading-relaxed text-orange-700 dark:text-orange-300">
              <div className="flex items-start gap-3">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                <p>
                  Have a platform question? Please ask the AI Copilot in the bottom-right corner
                  before submitting feedback here. If it still doesn't answer your question, send it
                  to us and we'll take a look.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="category" className="text-xs text-foreground/80 font-medium">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category" className="bg-secondary/40 border-border h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general" className="text-xs">General Feedback - Share your thoughts or experience</SelectItem>
                    <SelectItem value="bug" className="text-xs">Bug Report - Something isn't working right</SelectItem>
                    <SelectItem value="feature" className="text-xs">Feature Request - I have an idea for a new feature</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback" className="text-xs text-foreground/80 font-medium">Your Feedback</Label>
                <Textarea
                  id="feedback"
                  placeholder="Tell us what's on your mind..."
                  className="min-h-[140px] resize-y bg-secondary/40 border-border p-3 text-sm placeholder:text-muted-foreground/60"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-foreground/80 font-medium">Attachments (optional)</Label>
                <div className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-secondary/20 transition-colors hover:bg-secondary/40">
                  <Upload className="h-5 w-5 text-muted-foreground mb-2" />
                </div>
              </div>

              <div className="pt-2">
                <Button 
                  type="submit" 
                  disabled={isSubmitting || !feedback.trim()} 
                  className="w-full bg-foreground text-background hover:bg-foreground/90 sm:w-auto"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Feedback"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
