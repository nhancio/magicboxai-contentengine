import { AnimatedWave } from "./animated-wave";

import { appSignInUrl } from "@/lib/config";

const footerLinks = {
  Product: [
    { name: "Supported", href: "#supported" },
    { name: "How it works", href: "#how-it-works" },
    { name: "Features", href: "#features" },
    { name: "Pricing", href: "#pricing" },
  ],
  "Use cases": [
    { name: "Founders", href: "#use-cases" },
    { name: "Solo founders", href: "#use-cases" },
    { name: "Agencies", href: "#use-cases" },
    { name: "D2C brands", href: "#use-cases" },
  ],
  Company: [
    { name: "FAQ", href: "#faq" },
    { name: "Contact", href: "mailto:support@magicboxai.in" },
  ],
  Legal: [
    { name: "Privacy", href: "/privacy.html" },
    { name: "Terms", href: "/terms.html" },
  ],
};

export function FooterSection() {
  return (
    <footer className="relative border-t border-foreground/10">
      <div className="absolute inset-0 h-64 opacity-20 pointer-events-none overflow-hidden">
        <AnimatedWave />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="py-16 lg:py-24">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-12 lg:gap-8">
            <div className="col-span-2">
              <a href="/" className="inline-flex items-center gap-2 mb-6">
                <img src="/logo-128.webp" alt="MagicBox" width={32} height={32} className="h-8 w-8 rounded-lg object-contain" />
                <span className="text-2xl font-display">MagicBox</span>
              </a>
              <p className="text-muted-foreground leading-relaxed mb-8 max-w-xs">
                MagicBox is AI marketing automation software for creating, approving,
                scheduling, and publishing social posts to Instagram, LinkedIn, and YouTube.
              </p>
              <div className="mb-6 flex flex-wrap gap-4 text-sm">
                <a
                  href="/privacy.html"
                  className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
                >
                  Privacy Policy
                </a>
                <a
                  href="/terms.html"
                  className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
                >
                  Terms of Service
                </a>
              </div>
              <a href="mailto:support@magicboxai.in" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                support@magicboxai.in
              </a>
            </div>

            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h3 className="text-sm font-medium mb-6">{title}</h3>
                <ul className="space-y-4">
                  {links.map((link) => (
                    <li key={link.name}>
                      <a href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2">
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="py-8 border-t border-foreground/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">© 2026 MagicBox. All rights reserved.</p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <a href={appSignInUrl()} className="hover:text-foreground transition-colors">Sign in</a>
            <span>Built in Hyderabad, India</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
