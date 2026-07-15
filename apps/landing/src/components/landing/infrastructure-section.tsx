import { useEffect, useState, useRef } from "react";

const channels = [
  { city: "Instagram", region: "Feed & Reels", latency: "9:00 AM" },
  { city: "X / Twitter", region: "Timeline", latency: "12:30 PM" },
  { city: "LinkedIn", region: "Company page", latency: "8:15 AM" },
  { city: "Facebook", region: "Page", latency: "6:00 PM" },
  { city: "Threads", region: "Feed", latency: "1:00 PM" },
  { city: "YouTube", region: "Community", latency: "5:30 PM" },
];

export function InfrastructureSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeLocation, setActiveLocation] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsVisible(true);
    }, { threshold: 0.1 });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setActiveLocation((prev) => (prev + 1) % channels.length), 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div className={`transition-all duration-700 ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}>
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
              <span className="w-8 h-px bg-foreground/30" />
              The engine
            </span>
            <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-8">
              Posts at the
              <br />
              right moment.
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-12">
              A three-tick scheduler plans, generates, and publishes on its own — with retries,
              back-off, and idempotent slots so nothing double-posts and nothing gets missed.
            </p>
            <div className="grid grid-cols-3 gap-8">
              <div>
                <div className="text-4xl lg:text-5xl font-display mb-2">3</div>
                <div className="text-sm text-muted-foreground">Scheduler ticks</div>
              </div>
              <div>
                <div className="text-4xl lg:text-5xl font-display mb-2">24/7</div>
                <div className="text-sm text-muted-foreground">Always running</div>
              </div>
              <div>
                <div className="text-4xl lg:text-5xl font-display mb-2">0</div>
                <div className="text-sm text-muted-foreground">Double posts</div>
              </div>
            </div>
          </div>

          <div className={`transition-all duration-700 delay-200 ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}>
            <div className="border border-foreground/10">
              <div className="px-6 py-4 border-b border-foreground/10 flex items-center justify-between">
                <span className="text-sm font-mono text-muted-foreground">Next posting slots</span>
                <span className="flex items-center gap-2 text-xs font-mono text-brand">
                  <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                  All connected
                </span>
              </div>
              <div>
                {channels.map((location, index) => (
                  <div key={location.city} className={`px-6 py-5 border-b border-foreground/5 last:border-b-0 flex items-center justify-between transition-all duration-300 ${activeLocation === index ? "bg-brand/[0.03]" : ""}`}>
                    <div className="flex items-center gap-4">
                      <span className={`w-2 h-2 rounded-full transition-colors duration-300 ${activeLocation === index ? "bg-brand" : "bg-foreground/20"}`} />
                      <div>
                        <div className="font-medium">{location.city}</div>
                        <div className="text-sm text-muted-foreground">{location.region}</div>
                      </div>
                    </div>
                    <span className="font-mono text-sm text-muted-foreground">{location.latency}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
