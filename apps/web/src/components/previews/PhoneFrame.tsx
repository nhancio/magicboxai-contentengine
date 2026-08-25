import { useEffect, useRef, useState, type ReactNode } from "react";
import { BatteryFull, Signal, Wifi } from "lucide-react";
import { cn } from "@shared/lib/utils";

/** iPhone 14 Pro Max, in points: 430x932 screen, 125x36 Dynamic Island. */
const PHONE_W = 430;
const PHONE_H = 932;

/**
 * The one device shell every preview in the app renders inside.
 *
 * The phone is laid out at true iPhone 14 Pro Max size and then scaled to
 * whatever space the host gives it, so its proportions — and the proportions of
 * the app UI inside it — are identical on every screen. Scaling the box instead
 * of restyling the contents is what keeps a 13px LinkedIn caption looking like
 * 13px on a phone rather than growing as the frame shrinks.
 *
 * Children are the platform UI. Their own card chrome (rounded corners, border,
 * shadow, max-width) is stripped here because the screen owns the rounding —
 * otherwise every preview reads as a card floating inside a phone.
 */
export default function PhoneFrame({
  children,
  className,
  maxScale = 1,
}: {
  children: ReactNode;
  className?: string;
  /** Cap the scale when a rail is wide enough to render the phone life-size. */
  maxScale?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const fit = () => {
      const { clientWidth: w, clientHeight: h } = host;
      if (!w || !h) return;
      // A host with auto height reports something tiny; the floor keeps the
      // phone usable there instead of collapsing to a sliver.
      setScale(Math.max(0.42, Math.min(maxScale, Math.min(w / PHONE_W, h / PHONE_H))));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    return () => observer.disconnect();
  }, [maxScale]);

  return (
    <div
      ref={hostRef}
      className={cn("relative flex h-full w-full items-center justify-center", className)}
    >
      <div
        className="relative shrink-0"
        style={{ width: PHONE_W * scale, height: PHONE_H * scale }}
      >
        <div
          className="absolute left-0 top-0"
          style={{
            width: PHONE_W,
            height: PHONE_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {/* side buttons */}
          <span className="absolute -left-[3px] top-[152px] h-[32px] w-[3px] rounded-l bg-neutral-600" />
          <span className="absolute -left-[3px] top-[214px] h-[62px] w-[3px] rounded-l bg-neutral-600" />
          <span className="absolute -left-[3px] top-[292px] h-[62px] w-[3px] rounded-l bg-neutral-600" />
          <span className="absolute -right-[3px] top-[240px] h-[96px] w-[3px] rounded-r bg-neutral-600" />
          {/* titanium band → bezel → screen */}
          <div className="h-full w-full rounded-[62px] bg-gradient-to-b from-neutral-500 via-neutral-700 to-neutral-600 p-[3px] shadow-[0_40px_80px_-24px_rgba(0,0,0,0.6)]">
            <div className="h-full w-full rounded-[59px] bg-black p-[11px]">
              <div className="relative h-full w-full overflow-hidden rounded-[48px] bg-black">
                {/* status bar — opaque, so the feed scrolls under it as on iOS */}
                <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex h-[54px] items-center justify-between bg-black/95 px-[30px] pt-[6px] text-[15px] font-semibold text-white">
                  <span className="tabular-nums">9:41</span>
                  <span className="flex items-center gap-[6px]">
                    <Signal className="h-[15px] w-[15px]" />
                    <Wifi className="h-[15px] w-[15px]" />
                    <BatteryFull className="h-[17px] w-[17px]" />
                  </span>
                </div>
                {/* Dynamic Island — 125x36 */}
                <span className="pointer-events-none absolute left-1/2 top-[11px] z-40 h-[36px] w-[125px] -translate-x-1/2 rounded-[18px] bg-black" />
                <div className="no-scrollbar h-full overflow-y-auto pb-[34px] pt-[54px] [&>*]:max-w-none [&>*]:rounded-none [&>*]:border-0 [&>*]:shadow-none [&>div>div]:max-w-none [&>div>div]:rounded-none [&>div>div]:border-0 [&>div>div]:shadow-none">
                  {children}
                </div>
                {/* home indicator — 140x5 */}
                <span className="pointer-events-none absolute bottom-[8px] left-1/2 z-30 h-[5px] w-[140px] -translate-x-1/2 rounded-full bg-white/80" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
