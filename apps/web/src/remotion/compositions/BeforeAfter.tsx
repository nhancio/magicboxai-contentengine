import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Sequence,
  spring,
  Easing,
  Img,
} from "remotion";
import type { VideoProps } from "../schema";
import { AnimatedText } from "../components/AnimatedText";
import { AvatarBubble } from "../components/AvatarBubble";
import { CaptionOverlay } from "../components/CaptionOverlay";

/**
 * Before & After Template
 * Structure: Hook -> "Before" state -> Transition -> "After" reveal -> CTA
 * Duration: ~15s at 30fps = 450 frames
 */
export const BeforeAfter: React.FC<VideoProps> = ({
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
  const { fps, durationInFrames } = useVideoConfig();

  const scriptSegments = script
    ? script.split(/[.!?]+/).filter((s) => s.trim().length > 0).slice(0, 4)
    : ["Before this, everything was different"];

  return (
    <AbsoluteFill
      style={{
        background: "#050508",
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Scene 1: Hook "Watch This Transformation" (0-90 frames, ~3s) */}
      <Sequence from={0} durationInFrames={90}>
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(circle at center, #1a0d2e, #050508)",
          }}
        >
          {/* Dramatic flash */}
          <FlashEffect />

          <AnimatedText
            text={hook}
            startFrame={15}
            animation="scaleIn"
            style={{
              fontSize: 60,
              fontWeight: 900,
              color: "white",
              textAlign: "center",
              padding: "0 80px",
              lineHeight: 1.2,
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: "BEFORE" state (80-200 frames, ~4s) */}
      <Sequence from={80} durationInFrames={120}>
        <AbsoluteFill>
          {/* Dark desaturated background */}
          <AbsoluteFill
            style={{
              background:
                "linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
              filter: "saturate(0.3)",
            }}
          />

          {/* BEFORE label */}
          <BeforeLabel />

          <AbsoluteFill
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 30,
              padding: 80,
            }}
          >
            {/* Sad/frustrated state illustration */}
            <div
              style={{
                width: 300,
                height: 300,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.03)",
                border: "2px dashed rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 120,
              }}
            >
              &#128542;
            </div>

            <AnimatedText
              text={scriptSegments[0]?.trim() || "Before..."}
              startFrame={20}
              animation="fadeUp"
              style={{
                fontSize: 38,
                fontWeight: 600,
                color: "rgba(255,255,255,0.6)",
                textAlign: "center",
                maxWidth: 700,
                lineHeight: 1.4,
              }}
            />

            {scriptSegments[1] && (
              <AnimatedText
                text={scriptSegments[1].trim()}
                startFrame={50}
                animation="fadeUp"
                style={{
                  fontSize: 32,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.4)",
                  textAlign: "center",
                  maxWidth: 700,
                  lineHeight: 1.4,
                }}
              />
            )}
          </AbsoluteFill>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: Transition wipe + Product reveal (190-330 frames, ~5s) */}
      <Sequence from={190} durationInFrames={140}>
        <AbsoluteFill>
          {/* Colorful gradient background */}
          <AbsoluteFill
            style={{
              background: `linear-gradient(135deg, ${brandColor}20, #0a0a0a 50%, ${brandColor}10)`,
            }}
          />

          {/* AFTER label */}
          <AfterLabel brandColor={brandColor} />

          {/* Wipe transition */}
          <WipeTransition brandColor={brandColor} fps={fps} />

          <AbsoluteFill
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 30,
              padding: 60,
            }}
          >
            {/* Product image reveal */}
            {productImageUrl && (
              <ProductReveal
                src={productImageUrl}
                brandColor={brandColor}
                fps={fps}
              />
            )}

            <AnimatedText
              text={`Then I found ${productName}`}
              startFrame={30}
              animation="fadeUp"
              style={{
                fontSize: 44,
                fontWeight: 700,
                color: "white",
                textAlign: "center",
              }}
            />

            {scriptSegments[2] && (
              <AnimatedText
                text={scriptSegments[2].trim()}
                startFrame={60}
                animation="fadeUp"
                style={{
                  fontSize: 32,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.7)",
                  textAlign: "center",
                  maxWidth: 750,
                  lineHeight: 1.4,
                }}
              />
            )}

            {/* Happy state */}
            <div
              style={{
                position: "absolute",
                top: 140,
                right: 80,
                fontSize: 80,
              }}
            >
              &#10024;
            </div>
          </AbsoluteFill>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 4: Results + CTA (320-450 frames, ~4s) */}
      <Sequence from={320} durationInFrames={130}>
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse at center, ${brandColor}15, #050508)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 40,
          }}
        >
          {/* Side by side comparison */}
          <ComparisonBar brandColor={brandColor} fps={fps} />

          <AnimatedText
            text={cta}
            startFrame={40}
            animation="scaleIn"
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: "white",
              textAlign: "center",
              padding: "0 60px",
              lineHeight: 1.3,
            }}
          />

          {/* Swipe up arrow */}
          <SwipeUpArrow brandColor={brandColor} />
        </AbsoluteFill>
      </Sequence>

      {/* Avatar bubble */}
      <AvatarBubble
        avatarUrl={avatarUrl}
        avatarName={avatarName}
        startFrame={5}
        size={110}
        position="bottom-right"
      />

      {/* Captions */}
      <CaptionOverlay
        captions={captions}
        startFrame={80}
        frameDuration={Math.floor((durationInFrames - 80) / Math.max(captions.length, 1))}
        position="bottom"
      />
    </AbsoluteFill>
  );
};

const FlashEffect: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 5, 15], [1, 0.8, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "white",
        opacity,
        zIndex: 50,
      }}
    />
  );
};

const BeforeLabel: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [5, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        left: 60,
        opacity,
        zIndex: 10,
      }}
    >
      <div
        style={{
          background: "rgba(239, 68, 68, 0.2)",
          border: "2px solid rgba(239, 68, 68, 0.4)",
          borderRadius: 16,
          padding: "12px 32px",
          fontSize: 32,
          fontWeight: 800,
          color: "#ef4444",
          letterSpacing: 4,
          textTransform: "uppercase",
        }}
      >
        BEFORE
      </div>
    </div>
  );
};

const AfterLabel: React.FC<{ brandColor: string }> = ({ brandColor }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [20, 35], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        right: 60,
        opacity,
        zIndex: 10,
      }}
    >
      <div
        style={{
          background: `${brandColor}30`,
          border: `2px solid ${brandColor}60`,
          borderRadius: 16,
          padding: "12px 32px",
          fontSize: 32,
          fontWeight: 800,
          color: "#22c55e",
          letterSpacing: 4,
          textTransform: "uppercase",
        }}
      >
        AFTER
      </div>
    </div>
  );
};

const WipeTransition: React.FC<{ brandColor: string; fps: number }> = ({
  brandColor,
  fps,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  if (progress >= 1) return null;

  return (
    <AbsoluteFill
      style={{
        background: brandColor,
        clipPath: `inset(0 ${progress * 100}% 0 0)`,
        zIndex: 30,
      }}
    />
  );
};

const ProductReveal: React.FC<{
  src: string;
  brandColor: string;
  fps: number;
}> = ({ src, brandColor, fps }) => {
  const frame = useCurrentFrame();
  const scale = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: { damping: 10, mass: 0.5, stiffness: 100 },
  });

  const glow = interpolate(Math.sin(frame * 0.1), [-1, 1], [20, 40]);

  return (
    <div
      style={{
        width: 380,
        height: 380,
        borderRadius: 32,
        overflow: "hidden",
        transform: `scale(${scale})`,
        boxShadow: `0 0 ${glow}px ${brandColor}60, 0 20px 60px rgba(0,0,0,0.5)`,
        border: `3px solid ${brandColor}40`,
      }}
    >
      <Img
        src={src}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </div>
  );
};

const ComparisonBar: React.FC<{ brandColor: string; fps: number }> = ({
  brandColor,
  fps,
}) => {
  const frame = useCurrentFrame();
  const width = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 15, mass: 0.8, stiffness: 80 },
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        transform: `scaleX(${width})`,
        transformOrigin: "center",
      }}
    >
      <div
        style={{
          padding: "16px 32px",
          background: "rgba(239, 68, 68, 0.15)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: 16,
          fontSize: 28,
          fontWeight: 700,
          color: "#ef4444",
        }}
      >
        Before &#128542;
      </div>
      <div
        style={{
          fontSize: 40,
          color: "rgba(255,255,255,0.3)",
        }}
      >
        &#8594;
      </div>
      <div
        style={{
          padding: "16px 32px",
          background: `${brandColor}20`,
          border: `1px solid ${brandColor}40`,
          borderRadius: 16,
          fontSize: 28,
          fontWeight: 700,
          color: "#22c55e",
        }}
      >
        After &#128525;
      </div>
    </div>
  );
};

const SwipeUpArrow: React.FC<{ brandColor: string }> = ({ brandColor }) => {
  const frame = useCurrentFrame();
  const bounce = Math.sin(frame * 0.15) * 10;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 180,
        left: "50%",
        transform: `translateX(-50%) translateY(${bounce}px)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 36,
          color: brandColor,
        }}
      >
        &#8593;
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: "rgba(255,255,255,0.5)",
          letterSpacing: 2,
        }}
      >
        SWIPE UP
      </div>
    </div>
  );
};
