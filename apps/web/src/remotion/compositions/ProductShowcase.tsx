import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Sequence,
  Easing,
  Img,
} from "remotion";
import type { VideoProps } from "../schema";
import { AnimatedText } from "../components/AnimatedText";
import { AvatarBubble } from "../components/AvatarBubble";
import { ProductImage } from "../components/ProductImage";
import { CaptionOverlay } from "../components/CaptionOverlay";

/**
 * Product Showcase Template
 * Structure: Hook -> Product Reveal -> Features -> CTA
 * Duration: ~15s at 30fps = 450 frames
 */
export const ProductShowcase: React.FC<VideoProps> = ({
  avatarUrl,
  avatarName,
  productImageUrl,
  productName,
  hook,
  script,
  cta,
  captions,
  brandColor,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Background gradient animation
  const gradientAngle = interpolate(frame, [0, durationInFrames], [135, 200]);
  const bgOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Split script into segments for display
  const scriptSegments = script
    ? script.split(/[.!?]+/).filter((s) => s.trim().length > 0).slice(0, 3)
    : ["Your product description"];

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${gradientAngle}deg, #0f0a1a 0%, #1a0d2e 40%, #0d1117 100%)`,
        opacity: bgOpacity,
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Animated background particles */}
      <AbsoluteFill style={{ overflow: "hidden" }}>
        {[...Array(6)].map((_, i) => {
          const x = interpolate(
            frame + i * 50,
            [0, durationInFrames],
            [100 + i * 150, 200 + i * 120]
          );
          const y = interpolate(
            Math.sin((frame + i * 30) * 0.02),
            [-1, 1],
            [200 + i * 250, 400 + i * 200]
          );
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: 200 + i * 40,
                height: 200 + i * 40,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${brandColor}15, transparent)`,
                filter: "blur(40px)",
              }}
            />
          );
        })}
      </AbsoluteFill>

      {/* Scene 1: Hook (frames 0-90, ~3s) */}
      <Sequence from={0} durationInFrames={90}>
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 80,
          }}
        >
          <AnimatedText
            text={hook}
            startFrame={10}
            animation="scaleIn"
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: "white",
              textAlign: "center",
              lineHeight: 1.2,
              textShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Product Reveal (frames 80-240, ~5s) */}
      <Sequence from={80} durationInFrames={160}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 60,
            gap: 40,
          }}
        >
          <ProductImage
            src={productImageUrl}
            startFrame={10}
            animation="spin3d"
            style={{
              width: 500,
              height: 500,
              borderRadius: 32,
              overflow: "hidden",
              boxShadow: `0 20px 60px ${brandColor}40`,
            }}
          />
          <AnimatedText
            text={productName}
            startFrame={30}
            animation="fadeUp"
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: "white",
              textAlign: "center",
            }}
          />
          {scriptSegments[0] && (
            <AnimatedText
              text={scriptSegments[0].trim()}
              startFrame={50}
              animation="fadeUp"
              style={{
                fontSize: 32,
                fontWeight: 500,
                color: "rgba(255,255,255,0.7)",
                textAlign: "center",
                maxWidth: 800,
                lineHeight: 1.4,
              }}
            />
          )}
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: Features/Script (frames 230-370, ~5s) */}
      <Sequence from={230} durationInFrames={140}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: 80,
            gap: 40,
          }}
        >
          {scriptSegments.slice(0, 3).map((segment, i) => (
            <AnimatedText
              key={i}
              text={segment.trim()}
              startFrame={i * 30 + 10}
              animation="slideLeft"
              style={{
                fontSize: 38,
                fontWeight: 600,
                color: "white",
                lineHeight: 1.4,
                paddingLeft: 30,
                borderLeft: `4px solid ${brandColor}`,
              }}
            />
          ))}

          {productImageUrl && (
            <ProductImage
              src={productImageUrl}
              startFrame={10}
              animation="float"
              style={{
                position: "absolute",
                right: 60,
                bottom: 300,
                width: 280,
                height: 280,
                borderRadius: 24,
                overflow: "hidden",
              }}
            />
          )}
        </AbsoluteFill>
      </Sequence>

      {/* Scene 4: CTA (frames 360-450, ~3s) */}
      <Sequence from={360} durationInFrames={90}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 40,
          }}
        >
          <AnimatedText
            text={cta}
            startFrame={10}
            animation="scaleIn"
            style={{
              fontSize: 52,
              fontWeight: 800,
              color: "white",
              textAlign: "center",
              padding: "0 60px",
            }}
          />
          {/* Animated CTA button */}
          <CTAButton brandColor={brandColor} startFrame={30} />
        </AbsoluteFill>
      </Sequence>

      {/* Avatar bubble - visible throughout */}
      <AvatarBubble
        avatarUrl={avatarUrl}
        avatarName={avatarName}
        startFrame={5}
        size={120}
        position="bottom-left"
      />

      {/* Captions overlay */}
      <CaptionOverlay
        captions={captions}
        startFrame={90}
        frameDuration={Math.floor((durationInFrames - 90) / Math.max(captions.length, 1))}
      />

      {/* Top brand bar */}
      <Sequence from={0}>
        <TopBar avatarName={avatarName} brandColor={brandColor} />
      </Sequence>
    </AbsoluteFill>
  );
};

const CTAButton: React.FC<{ brandColor: string; startFrame: number }> = ({
  brandColor,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const relativeFrame = frame - startFrame;
  if (relativeFrame < 0) return null;

  const opacity = interpolate(relativeFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });
  const scale = interpolate(relativeFrame, [0, 20], [0.8, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.5)),
  });
  const pulse = 1 + Math.sin(relativeFrame * 0.15) * 0.03;

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale * pulse})`,
        background: `linear-gradient(135deg, ${brandColor}, #6366f1)`,
        padding: "24px 64px",
        borderRadius: 20,
        fontSize: 32,
        fontWeight: 700,
        color: "white",
        boxShadow: `0 8px 32px ${brandColor}50`,
        letterSpacing: 1,
      }}
    >
      SHOP NOW
    </div>
  );
};

const TopBar: React.FC<{ avatarName: string; brandColor: string }> = ({
  avatarName,
  brandColor,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 0.8], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        padding: "50px 60px 20px",
        background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)",
        opacity,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 5,
      }}
    >
      <div
        style={{
          fontSize: 24,
          fontWeight: 600,
          color: "rgba(255,255,255,0.7)",
        }}
      >
        @{avatarName.toLowerCase().replace(/\s+/g, "_")}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 500,
          color: brandColor,
          background: `${brandColor}20`,
          padding: "6px 16px",
          borderRadius: 20,
        }}
      >
        AD
      </div>
    </div>
  );
};
