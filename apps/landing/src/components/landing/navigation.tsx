import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { appLoginUrl, appSignInUrl } from "@/lib/config";
import { captureEvent } from "@shared/lib/analytics";

const navLinks = [
  { name: "About", href: "#about-magicbox" },
  { name: "Supported", href: "#supported" },
  { name: "How it works", href: "#how-it-works" },
  { name: "Features", href: "#features" },
  { name: "Pricing", href: "#pricing" },
];

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Cross-subdomain hint the app sets on login (Domain=.magicboxai.in). This
  // changes only the label: dashboard traffic still passes through /login so
  // a stale hint can never bypass Firebase's real session check.
  useEffect(() => {
    setSignedIn(/(?:^|;\s*)mb_signed_in=1(?:;|$)/.test(document.cookie));
  }, []);

  return (
    <header
      className={`fixed z-50 transition-all duration-500 ${
        isScrolled ? "top-4 left-4 right-4" : "top-0 left-0 right-0"
      }`}
    >
      <nav
        className={`mx-auto transition-all duration-500 ${
          isScrolled || isMobileMenuOpen
            ? "bg-background/80 backdrop-blur-xl border border-foreground/10 rounded-2xl shadow-lg max-w-[1200px]"
            : "bg-transparent max-w-[1400px]"
        }`}
      >
        <div
          className={`flex items-center justify-between transition-all duration-500 px-6 lg:px-8 ${
            isScrolled ? "h-14" : "h-20"
          }`}
        >
          <a href="/" className="flex items-center gap-2 group">
            <img
              src="/logo-128.webp"
              alt="MagicBox"
              width={36}
              height={36}
              className={`rounded-lg object-contain transition-all duration-500 ${isScrolled ? "h-7 w-7" : "h-9 w-9"}`}
            />
            <span className={`font-display tracking-tight transition-all duration-500 ${isScrolled ? "text-xl" : "text-2xl"}`}>
              MagicBox
            </span>
          </a>

          <div className="hidden md:flex items-center gap-12">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-sm text-foreground/85 hover:text-foreground transition-colors duration-300 relative group"
              >
                {link.name}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-brand transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            {signedIn ? (
              <Button
                asChild
                size="sm"
                variant="brand"
                className={`rounded-full transition-all duration-500 ${isScrolled ? "px-4 h-8 text-xs" : "px-6 h-9"}`}
              >
                <a href={appLoginUrl("/")}>Go to dashboard</a>
              </Button>
            ) : (
              <>
                <a
                  href={appSignInUrl()}
                  className={`text-foreground/85 hover:text-foreground font-medium transition-all duration-500 ${isScrolled ? "text-xs" : "text-sm"}`}
                >
                  Sign in
                </a>
                <Button
                  asChild
                  size="sm"
                  variant="brand"
                  className={`rounded-full transition-all duration-500 ${isScrolled ? "px-4 h-8 text-xs" : "px-6 h-9"}`}
                >
                  <a
                    href={appLoginUrl()}
                    onClick={() => captureEvent("landing_cta_clicked", { cta: "nav_create_plan", destination: "onboarding" })}
                  >
                    Create a plan
                  </a>
                </Button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      <div
        className={`md:hidden fixed inset-0 bg-background z-40 transition-all duration-500 ${
          isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{ top: 0 }}
      >
        <div className="flex flex-col h-full px-8 pt-28 pb-8">
          <div className="flex-1 flex flex-col justify-center gap-8">
            {navLinks.map((link, i) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-5xl font-display text-foreground hover:text-muted-foreground transition-all duration-500 ${
                  isMobileMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: isMobileMenuOpen ? `${i * 75}ms` : "0ms" }}
              >
                {link.name}
              </a>
            ))}
          </div>

          <div
            className={`flex gap-4 pt-8 border-t border-foreground/10 transition-all duration-500 ${
              isMobileMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: isMobileMenuOpen ? "300ms" : "0ms" }}
          >
            {signedIn ? (
              <Button asChild variant="brand" className="flex-1 rounded-full h-14 text-base">
                <a href={appLoginUrl("/")}>Go to dashboard</a>
              </Button>
            ) : (
              <>
                <Button asChild variant="outline" className="flex-1 rounded-full h-14 text-base">
                  <a href={appSignInUrl()}>Sign in</a>
                </Button>
                <Button asChild variant="brand" className="flex-1 rounded-full h-14 text-base">
                  <a
                    href={appLoginUrl()}
                    onClick={() => captureEvent("landing_cta_clicked", { cta: "mobile_nav_create_plan", destination: "onboarding" })}
                  >
                    Create a plan
                  </a>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
