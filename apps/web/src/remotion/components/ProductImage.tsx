import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  Easing,
} from "remotion";

interface ProductImageProps {
  src?: string;
  startFrame: number;
  style?: React.CSSProperties;
  animation?: "zoomIn" | "float" | "reveal" | "spin3d";
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  startFrame,
  style,
  animation = "zoomIn",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const relativeFrame = frame - startFrame;

  if (relativeFrame < 0 || !src) return null;

  let transform = "none";
  let opacity = 1;

  switch (animation) {
    case "zoomIn": {
      const scale = spring({
        frame: relativeFrame,
        fps,
        config: { damping: 12, mass: 0.8, stiffness: 100 },
      });
      opacity = interpolate(relativeFrame, [0, 10], [0, 1], {
        extrapolateRight: "clamp",
      });
      transform = `scale(${scale})`;
      break;
    }
    case "float": {
      const floatY = Math.sin(relativeFrame * 0.06) * 12;
      opacity = interpolate(relativeFrame, [0, 15], [0, 1], {
        extrapolateRight: "clamp",
      });
      const scale = interpolate(relativeFrame, [0, 20], [0.8, 1], {
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      });
      transform = `translateY(${floatY}px) scale(${scale})`;
      break;
    }
    case "reveal": {
      opacity = interpolate(relativeFrame, [0, 20], [0, 1], {
        extrapolateRight: "clamp",
      });
      const clipProgress = interpolate(relativeFrame, [0, 25], [100, 0], {
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      });
      return (
        <div
          style={{
            ...style,
            opacity,
            clipPath: `inset(0 ${clipProgress}% 0 0)`,
          }}
        >
          <Img
            src={src}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        </div>
      );
    }
    case "spin3d": {
      opacity = interpolate(relativeFrame, [0, 10], [0, 1], {
        extrapolateRight: "clamp",
      });
      const rotateY = interpolate(relativeFrame, [0, 30], [90, 0], {
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      });
      transform = `perspective(800px) rotateY(${rotateY}deg)`;
      break;
    }
  }

  return (
    <div style={{ ...style, opacity, transform }}>
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
    </div>
  );
};
