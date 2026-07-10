import React from "react";
import {
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  Img,
} from "remotion";

interface AvatarBubbleProps {
  avatarUrl?: string;
  avatarName: string;
  startFrame?: number;
  size?: number;
  position?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
}

export const AvatarBubble: React.FC<AvatarBubbleProps> = ({
  avatarUrl,
  avatarName,
  startFrame = 0,
  size = 160,
  position = "bottom-left",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const relativeFrame = frame - startFrame;

  if (relativeFrame < 0) return null;

  const scale = spring({
    frame: relativeFrame,
    fps,
    config: { damping: 10, mass: 0.6, stiffness: 150 },
  });

  const borderPulse = interpolate(
    Math.sin(relativeFrame * 0.08),
    [-1, 1],
    [3, 6]
  );

  const positionStyles: React.CSSProperties = {
    position: "absolute",
    ...(position.includes("bottom") ? { bottom: 100 } : { top: 100 }),
    ...(position.includes("left") ? { left: 60 } : { right: 60 }),
  };

  return (
    <div
      style={{
        ...positionStyles,
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        border: `${borderPulse}px solid rgba(139, 92, 246, 0.8)`,
        boxShadow: "0 8px 32px rgba(139, 92, 246, 0.3)",
        transform: `scale(${scale})`,
        zIndex: 10,
      }}
    >
      {avatarUrl ? (
        <Img
          src={avatarUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: size * 0.4,
            fontWeight: 700,
            color: "white",
          }}
        >
          {avatarName[0]?.toUpperCase() || "A"}
        </div>
      )}
    </div>
  );
};
