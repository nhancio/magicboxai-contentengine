import { useEffect, useRef, useState } from "react";
import { FileText, Send, Moon, Bot, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CALENDLY_URL } from "@/lib/config";

const capabilities = [
  { icon: FileText, label: "Create content" },
  { icon: Send, label: "Publish to platforms" },
  { icon: Moon, label: "Post content while you sleep" },
];

export function ApiMcpSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="api" ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className={`transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
              <span className="w-8 h-px bg-foreground/30" />
              Developers
            </span>
            <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-6 leading-[0.95]">
              Live with API,
              <br />
              MCP and Skill.
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-10 max-w-lg">
              Your AI agent can fully interact with MagicBox — create content and publish it,
              completely hands-free.
            </p>

            <div className="space-y-3 mb-10">
              {capabilities.map((c, i) => (
                <div
                  key={c.label}
                  className={`flex items-center gap-3 border border-foreground/10 bg-foreground/[0.02] px-4 py-3.5 rounded-lg hover:border-brand/30 transition-all duration-500 ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-6"}`}
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand/10 text-brand shrink-0">
                    <c.icon className="h-4 w-4" />
                  </div>
                  <span className="font-medium">{c.label}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-foreground/10 pt-8">
              <p className="text-muted-foreground max-w-lg mb-6">
                Want MagicBox under your own brand? Our white-label and Partner API let agencies
                and platforms run the full engine as their own.
              </p>
              <Button asChild size="lg" variant="brand" className="px-8 h-14 text-base rounded-full group">
                <a href={CALENDLY_URL}>
                  Enquire
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </a>
              </Button>
            </div>
          </div>

          <div className={`transition-all duration-1000 delay-200 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <div className="relative aspect-square rounded-3xl border border-foreground/10 bg-gradient-to-br from-brand/15 via-background to-foreground/[0.04] overflow-hidden flex items-center justify-center">
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage: "radial-gradient(circle, rgba(127,127,127,0.15) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />
              <div className="relative bg-background rounded-2xl border border-foreground/10 shadow-xl px-14 py-12 flex items-center justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand/15 text-brand">
                  <Bot className="h-10 w-10" />
                </div>
                <span className="absolute -left-3 top-6 rounded-full bg-brand text-brand-foreground text-sm font-medium px-3 py-1 shadow">
                  Kate
                </span>
                <span className="absolute -right-3 bottom-8 rounded-full bg-blue-500 text-white text-sm font-medium px-3 py-1 shadow">
                  Jake
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
