import React from "react";
import {
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  Easing,
} from "remotion";

interface CaptionOverlayProps {
  captions: string[];
  startFrame: number;
  /** Frames each caption is visible */
  frameDuration?: number;
  style?: React.CSSProperties;
  position?: "center" | "bottom" | "top";
}

export const CaptionOverlay: React.FC<CaptionOverlayProps> = ({
  captions,
  startFrame,
  frameDuration = 60,
  style,
  position = "bottom",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const relativeFrame = frame - startFrame;

  if (relativeFrame < 0 || captions.length === 0) return null;

  const captionIndex = Math.min(
    Math.floor(relativeFrame / frameDuration),
    captions.length - 1
  );
  const captionFrame = relativeFrame - captionIndex * frameDuration;
  const currentCaption = captions[captionIndex];

  if (!currentCaption) return null;

  const opacity = interpolate(
    captionFrame,
    [0, 8, frameDuration - 8, frameDuration],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  const scale = spring({
    frame: captionFrame,
    fps,
    config: { damping: 14, mass: 0.4, stiffness: 200 },
  });

  const positionStyles: React.CSSProperties = {
    position: "absolute",
    left: 60,
    right: 60,
    textAlign: "center",
    ...(position === "bottom" && { bottom: 280 }),
    ...(position === "center" && { top: "50%", transform: `translateY(-50%) scale(${scale})` }),
    ...(position === "top" && { top: 200 }),
  };

  // Highlight words in ALL CAPS
  const words = currentCaption.split(/\s+/);
  const renderedWords = words.map((word, i) => {
    const isHighlighted = word === word.toUpperCase() && word.length > 2;
    return (
      <span
        key={i}
        style={{
          color: isHighlighted ? "#fbbf24" : "white",
          fontWeight: isHighlighted ? 900 : 700,
        }}
      >
        {word}{" "}
      </span>
    );
  });

  return (
    <div
      style={{
        ...positionStyles,
        opacity,
        transform: position !== "center" ? `scale(${scale})` : positionStyles.transform,
        zIndex: 20,
        ...style,
      }}
    >
      <div
        style={{
          display: "inline-block",
          background: "rgba(0, 0, 0, 0.7)",
          backdropFilter: "blur(8px)",
          borderRadius: 16,
          padding: "16px 28px",
          fontSize: 42,
          fontWeight: 700,
          lineHeight: 1.3,
          letterSpacing: -0.5,
          textShadow: "0 2px 8px rgba(0,0,0,0.5)",
        }}
      >
        {renderedWords}
      </div>
    </div>
  );
};
