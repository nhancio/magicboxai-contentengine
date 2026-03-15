import { Link } from "react-router-dom";
import { Button } from "@shared/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-zinc-950">
      {/* Subtle animated background orb */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-3xl animate-glow" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center px-4 gap-6">
        <h1 className="text-[120px] sm:text-[160px] font-bold font-display leading-none text-gradient">
          404
        </h1>

        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-semibold text-white font-display">
            Page not found
          </h2>
          <p className="text-sm text-white/50 max-w-md">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <Link to="/">
          <Button className="h-11 px-6 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-medium shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-200">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
