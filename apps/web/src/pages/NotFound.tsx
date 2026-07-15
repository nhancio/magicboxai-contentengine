import { Link } from "react-router-dom";
import { Button } from "@shared/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center text-center gap-6">
        <span className="eyebrow">Error 404</span>

        <h1 className="text-[120px] sm:text-[160px] font-display leading-none text-foreground">
          404
        </h1>

        <div className="space-y-2">
          <h2 className="text-2xl font-display text-foreground">Page not found</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <Link to="/">
          <Button className="h-11 px-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
