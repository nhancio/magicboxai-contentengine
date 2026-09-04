import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, Img, Audio } from "remotion";
import type { MayaMemeCompositionProps } from "../schema";
import { AnimatedText } from "../components/AnimatedText";

function placementStyle(placement: string): React.CSSProperties {
  switch (placement) {
    case "bottom":
      return { bottom: 140, left: 40, right: 40, textAlign: "center" };
    case "bottom_right":
      return { bottom: 60, right: 40, maxWidth: "60%", textAlign: "right" };
    case "top_left":
      return { top: 80, left: 40, maxWidth: "70%", textAlign: "left" };
    case "center":
      return { top: "45%", left: 40, right: 40, textAlign: "center" };
    case "top":
    default:
      return { top: 80, left: 40, right: 40, textAlign: "center" };
  }
}

/**
 * Burns brand text overlays + a logo onto an already-generated base video
 * (either lip-synced onto the original viral clip, or a synthetic Veo render
 * — mayaTemplates.dispatchVideoGeneration decides which). Registered in
 * Root.tsx and rendered via apps/renderer's POST /api/render.
 */
export const MayaMemeComposition: React.FC<MayaMemeCompositionProps> = ({
  baseVideoUrl,
  textOverlays,
  subtitleCues,
  voiceAudioUrl,
  logoUrl,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Mute the source audio whenever we're laying a new voiceover over it —
          otherwise the original reel's dialogue talks over the brand script. */}
      <OffthreadVideo
        src={baseVideoUrl}
        muted={Boolean(voiceAudioUrl)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      {/* The adapted script, spoken over the footage. */}
      {voiceAudioUrl && <Audio src={voiceAudioUrl} />}

      {textOverlays.map((overlay, idx) => (
        <Sequence key={idx} from={overlay.startFrame} durationInFrames={overlay.durationFrames} layout="none">
          <AbsoluteFill>
            <div
              style={{
                position: "absolute",
                ...placementStyle(overlay.placement),
                padding: "12px 20px",
                borderRadius: 16,
                backgroundColor: overlay.bgColor || "rgba(0,0,0,0.8)",
              }}
            >
              <AnimatedText
                text={overlay.text}
                startFrame={0}
                animation="fadeUp"
                style={{
                  color: overlay.color,
                  fontSize: 44,
                  fontWeight: 800,
                  lineHeight: 1.2,
                  fontFamily: "system-ui, sans-serif",
                }}
              />
            </div>
          </AbsoluteFill>
        </Sequence>
      ))}

      {/* Mute-friendly captions, lower third — sits above the logo, below the
          bottom punchline overlay so the three don't collide. */}
      {subtitleCues.map((cue, idx) => (
        <Sequence key={`sub-${idx}`} from={cue.startFrame} durationInFrames={cue.durationFrames} layout="none">
          <AbsoluteFill>
            <div
              style={{
                position: "absolute",
                bottom: 320,
                left: 80,
                right: 80,
                textAlign: "center",
                padding: "10px 18px",
                borderRadius: 12,
                backgroundColor: "rgba(0,0,0,0.72)",
                color: "#FFFFFF",
                fontSize: 38,
                fontWeight: 700,
                lineHeight: 1.25,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {cue.text}
            </div>
          </AbsoluteFill>
        </Sequence>
      ))}

      {logoUrl && (
        <AbsoluteFill>
          <Img
            src={logoUrl}
            style={{
              position: "absolute",
              bottom: 48,
              left: "50%",
              transform: "translateX(-50%)",
              width: 140,
              height: 140,
              objectFit: "contain",
              opacity: 0.95,
            }}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
