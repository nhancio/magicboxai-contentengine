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
import { CaptionOverlay } from "../components/CaptionOverlay";

/**
 * Testimonial Style Template
 * Structure: Avatar intro -> "I tried this..." -> Product demo -> Result -> CTA
 * Feels like a real person talking to camera recommending a product.
 * Duration: ~15s at 30fps = 450 frames
 */
export const TestimonialStyle: React.FC<VideoProps> = ({
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
    : ["This product changed everything"];

  return (
    <AbsoluteFill
      style={{
        background: "#0a0a0a",
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Warm gradient background */}
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse at 50% 30%, ${brandColor}15, transparent 70%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "40%",
            background:
              "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
          }}
        />
      </AbsoluteFill>

      {/* Scene 1: Avatar Introduction (0-120 frames, ~4s) */}
      <Sequence from={0} durationInFrames={120}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 30,
          }}
        >
          {/* Large avatar photo */}
          <AvatarLargeEntry
            avatarUrl={avatarUrl}
            avatarName={avatarName}
            fps={fps}
          />

          <AnimatedText
            text={avatarName}
            startFrame={30}
            animation="fadeUp"
            style={{
              fontSize: 40,
              fontWeight: 700,
              color: "white",
            }}
          />

          <AnimatedText
            text={hook}
            startFrame={50}
            animation="fadeUp"
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: "white",
              textAlign: "center",
              padding: "0 80px",
              lineHeight: 1.3,
            }}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: "Let me tell you..." storytelling (110-230 frames, ~4s) */}
      <Sequence from={110} durationInFrames={120}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "160px 70px",
            gap: 40,
          }}
        >
          {/* Speech bubble style */}
          <SpeechBubble startFrame={10} fps={fps}>
            <div style={{ fontSize: 36, fontWeight: 600, color: "white", lineHeight: 1.5 }}>
              {scriptSegments[0]?.trim() || "This changed everything for me"}
            </div>
          </SpeechBubble>

          {scriptSegments[1] && (
            <SpeechBubble startFrame={50} fps={fps}>
              <div style={{ fontSize: 34, fontWeight: 500, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
                {scriptSegments[1].trim()}
              </div>
            </SpeechBubble>
          )}

          {/* Small avatar in corner */}
          <div
            style={{
              position: "absolute",
              bottom: 200,
              right: 60,
              width: 100,
              height: 100,
              borderRadius: "50%",
              overflow: "hidden",
              border: "3px solid rgba(255,255,255,0.2)",
            }}
          >
            {avatarUrl ? (
              <Img
                src={avatarUrl}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: `linear-gradient(135deg, ${brandColor}, #6366f1)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 36,
                  fontWeight: 700,
                  color: "white",
                }}
              >
                {avatarName[0]}
              </div>
            )}
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: Product highlight (220-340 frames, ~4s) */}
      <Sequence from={220} durationInFrames={120}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 40,
            padding: 60,
          }}
        >
          {productImageUrl && (
            <ProductCard
              src={productImageUrl}
              productName={productName}
              brandColor={brandColor}
              fps={fps}
            />
          )}

          {scriptSegments[2] && (
            <AnimatedText
              text={scriptSegments[2].trim()}
              startFrame={40}
              animation="fadeUp"
              style={{
                fontSize: 34,
                fontWeight: 600,
                color: "white",
                textAlign: "center",
                maxWidth: 800,
                lineHeight: 1.4,
              }}
            />
          )}
        </AbsoluteFill>
      </Sequence>

      {/* Scene 4: Star rating + CTA (330-450 frames, ~4s) */}
      <Sequence from={330} durationInFrames={120}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 30,
          }}
        >
          {/* Star rating animation */}
          <StarRating startFrame={10} fps={fps} brandColor={brandColor} />

          <AnimatedText
            text={`"${cta}"`}
            startFrame={40}
            animation="scaleIn"
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: "white",
              textAlign: "center",
              padding: "0 80px",
              fontStyle: "italic",
            }}
          />

          <AnimatedText
            text={`- ${avatarName}`}
            startFrame={60}
            animation="fadeUp"
            style={{
              fontSize: 28,
              fontWeight: 500,
              color: brandColor,
            }}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Captions */}
      <CaptionOverlay
        captions={captions}
        startFrame={60}
        frameDuration={Math.floor((durationInFrames - 60) / Math.max(captions.length, 1))}
        position="bottom"
      />
    </AbsoluteFill>
  );
};

const AvatarLargeEntry: React.FC<{
  avatarUrl?: string;
  avatarName: string;
  fps: number;
}> = ({ avatarUrl, avatarName, fps }) => {
  const frame = useCurrentFrame();
  const scale = spring({
    frame,
    fps,
    config: { damping: 10, mass: 0.8, stiffness: 100 },
  });
  const size = 220;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        border: "5px solid rgba(255,255,255,0.15)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        transform: `scale(${scale})`,
      }}
    >
      {avatarUrl ? (
        <Img
          src={avatarUrl}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: size * 0.4,
            fontWeight: 800,
            color: "white",
          }}
        >
          {avatarName[0]}
        </div>
      )}
    </div>
  );
};

const SpeechBubble: React.FC<{
  startFrame: number;
  fps: number;
  children: React.ReactNode;
}> = ({ startFrame, fps, children }) => {
  const frame = useCurrentFrame();
  const relativeFrame = frame - startFrame;
  if (relativeFrame < 0) return null;

  const scale = spring({
    frame: relativeFrame,
    fps,
    config: { damping: 12, mass: 0.5, stiffness: 180 },
  });
  const opacity = interpolate(relativeFrame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
        borderRadius: 24,
        padding: "28px 36px",
        border: "1px solid rgba(255,255,255,0.08)",
        transform: `scale(${scale})`,
        opacity,
        transformOrigin: "left center",
      }}
    >
      {children}
    </div>
  );
};

const ProductCard: React.FC<{
  src: string;
  productName: string;
  brandColor: string;
  fps: number;
}> = ({ src, productName, brandColor, fps }) => {
  const frame = useCurrentFrame();
  const scale = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.6, stiffness: 120 },
  });

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.05)",
        borderRadius: 32,
        padding: 24,
        border: `2px solid ${brandColor}40`,
        boxShadow: `0 20px 60px ${brandColor}20`,
        transform: `scale(${scale})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
      }}
    >
      <div
        style={{
          width: 400,
          height: 400,
          borderRadius: 24,
          overflow: "hidden",
        }}
      >
        <Img
          src={src}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>
      <div
        style={{
          fontSize: 36,
          fontWeight: 700,
          color: "white",
          textAlign: "center",
        }}
      >
        {productName}
      </div>
    </div>
  );
};

const StarRating: React.FC<{
  startFrame: number;
  fps: number;
  brandColor: string;
}> = ({ startFrame, fps, brandColor }) => {
  const frame = useCurrentFrame();
  const relativeFrame = frame - startFrame;
  if (relativeFrame < 0) return null;

  return (
    <div style={{ display: "flex", gap: 12 }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const starScale = spring({
          frame: Math.max(0, relativeFrame - i * 6),
          fps,
          config: { damping: 8, mass: 0.3, stiffness: 200 },
        });
        return (
          <div
            key={i}
            style={{
              fontSize: 56,
              transform: `scale(${starScale})`,
              color: "#fbbf24",
              textShadow: "0 4px 12px rgba(251, 191, 36, 0.4)",
            }}
          >
            &#9733;
          </div>
        );
      })}
    </div>
  );
};
