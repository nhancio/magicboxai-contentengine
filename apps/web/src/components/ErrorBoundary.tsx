import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@shared/components/ui/button";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { captureException } from "@shared/lib/analytics";

type Props = { children: ReactNode; label?: string };
type State = { error: Error | null };

const CHUNK_RELOAD_KEY = "mbx:chunk-reload";

function isChunkLoadError(error: Error): boolean {
  const msg = error.message || "";
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    error.name === "ChunkLoadError"
  );
}

/**
 * Catches render crashes so one broken page doesn't white-screen the whole SPA.
 * After a deploy, stale lazy chunks 404 — auto-reload once to pick up the new index.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`, error, info);
    captureException(error);
    if (isChunkLoadError(error) && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
      window.location.reload();
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    const chunkMiss = isChunkLoadError(this.state.error);

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-600" />
        <div>
          <h1 className="font-display text-2xl text-foreground">Something went wrong</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {chunkMiss
              ? "The app was updated. Refresh once to load the latest version."
              : "This screen hit an unexpected error. Try refreshing, or go back to the dashboard."}
          </p>
          <p className="mt-3 max-w-lg break-words font-mono text-[11px] text-muted-foreground/80">
            {this.state.error.message.slice(0, 240)}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              sessionStorage.removeItem(CHUNK_RELOAD_KEY);
              this.setState({ error: null });
              window.location.reload();
            }}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
          </Button>
          <Button asChild>
            <Link to="/">
              <Home className="mr-1.5 h-4 w-4" /> Dashboard
            </Link>
          </Button>
        </div>
      </div>
    );
  }
}

export function PageLoader() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Loading
        </p>
      </div>
    </div>
  );
}
