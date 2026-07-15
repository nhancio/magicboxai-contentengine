import { cn } from "../../lib/utils";

interface LottiePlayerProps {
  animationData?: unknown;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  size?: number;
}

export function LottiePlayer({
  className,
  size,
}: LottiePlayerProps) {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none relative select-none rounded-full bg-brand/10",
        "before:absolute before:inset-[18%] before:rounded-full before:bg-brand/15",
        "after:absolute after:inset-[36%] after:rounded-full after:bg-brand/70",
        className
      )}
      style={style}
    />
  );
}

export default LottiePlayer;
