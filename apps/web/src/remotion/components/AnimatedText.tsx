import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";

interface AnimatedTextProps {
  text: string;
  startFrame: number;
  style?: React.CSSProperties;
  className?: string;
  animation?: "fadeUp" | "scaleIn" | "typewriter" | "slideLeft";
  duration?: number;
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  startFrame,
  style,
  className,
  animation = "fadeUp",
  duration = 20,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const relativeFrame = frame - startFrame;

  if (relativeFrame < 0) return null;

  let opacity = 1;
  let transform = "none";

  switch (animation) {
    case "fadeUp": {
      opacity = interpolate(relativeFrame, [0, 12], [0, 1], {
        extrapolateRight: "clamp",
      });
      const translateY = interpolate(relativeFrame, [0, 15], [40, 0], {
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      });
      transform = `translateY(${translateY}px)`;
      break;
    }
    case "scaleIn": {
      const scale = spring({
        frame: relativeFrame,
        fps,
        config: { damping: 12, mass: 0.5, stiffness: 200 },
      });
      opacity = interpolate(relativeFrame, [0, 8], [0, 1], {
        extrapolateRight: "clamp",
      });
      transform = `scale(${scale})`;
      break;
    }
    case "slideLeft": {
      opacity = interpolate(relativeFrame, [0, 10], [0, 1], {
        extrapolateRight: "clamp",
      });
      const translateX = interpolate(relativeFrame, [0, 15], [60, 0], {
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      });
      transform = `translateX(${translateX}px)`;
      break;
    }
    case "typewriter": {
      const charsToShow = Math.floor(
        interpolate(relativeFrame, [0, duration], [0, text.length], {
          extrapolateRight: "clamp",
        })
      );
      return (
        <div style={{ ...style, opacity: 1 }} className={className}>
          {text.slice(0, charsToShow)}
          {charsToShow < text.length && (
            <span style={{ opacity: relativeFrame % 8 < 4 ? 1 : 0 }}>|</span>
          )}
        </div>
      );
    }
  }

  return (
    <div style={{ ...style, opacity, transform }} className={className}>
      {text}
    </div>
  );
};
