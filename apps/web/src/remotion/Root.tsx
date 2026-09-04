import React from "react";
import { Composition } from "remotion";
import { videoPropsSchema, mayaMemeCompositionSchema, VIDEO_WIDTH, VIDEO_HEIGHT, VIDEO_FPS } from "./schema";
import { ProductShowcase } from "./compositions/ProductShowcase";
import { TestimonialStyle } from "./compositions/TestimonialStyle";
import { BeforeAfter } from "./compositions/BeforeAfter";
import { MayaMemeComposition } from "./compositions/MayaMemeComposition";

/**
 * Remotion Root — registers all video compositions.
 * Used by the Remotion CLI for rendering, and also referenced
 * by the Player component in the web app.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ProductShowcase"
        component={ProductShowcase}
        durationInFrames={450}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        schema={videoPropsSchema}
        defaultProps={{
          avatarName: "Creator",
          productName: "Product",
          hook: "Check this out!",
          script: "This product is amazing. It solves real problems. You need to try it.",
          cta: "Link in bio!",
          captions: ["Check this out!", "AMAZING product", "Get yours NOW"],
          brandColor: "#8b5cf6",
          platform: "TikTok" as const,
          tone: "Bold",
        }}
      />
      <Composition
        id="TestimonialStyle"
        component={TestimonialStyle}
        durationInFrames={450}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        schema={videoPropsSchema}
        defaultProps={{
          avatarName: "Creator",
          productName: "Product",
          hook: "I tried this and here's what happened...",
          script: "This changed everything for me. I was skeptical at first. But the results speak for themselves.",
          cta: "Trust me, you need this",
          captions: ["I was SKEPTICAL", "Then THIS happened", "Mind BLOWN"],
          brandColor: "#ec4899",
          platform: "Instagram Reels" as const,
          tone: "Storytelling",
        }}
      />
      <Composition
        id="BeforeAfter"
        component={BeforeAfter}
        durationInFrames={450}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        schema={videoPropsSchema}
        defaultProps={{
          avatarName: "Creator",
          productName: "Product",
          hook: "Watch this transformation",
          script: "Before this, I struggled every day. Then everything changed. The results are incredible.",
          cta: "Don't wait like I did - start now",
          captions: ["BEFORE", "The transformation", "AFTER - WOW"],
          brandColor: "#8b5cf6",
          platform: "TikTok" as const,
          tone: "Bold",
        }}
      />
      <Composition
        id="MayaMemeComposition"
        component={MayaMemeComposition}
        durationInFrames={240}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        schema={mayaMemeCompositionSchema}
        defaultProps={{
          baseVideoUrl: "https://assets.mixkit.co/videos/preview/mixkit-hands-holding-a-smartphone-playing-a-video-41584-large.mp4",
          durationInFrames: 240,
          fps: VIDEO_FPS,
          textOverlays: [],
          subtitleCues: [],
        }}
        calculateMetadata={async ({ props }) => ({
          durationInFrames: props.durationInFrames,
          fps: props.fps,
        })}
      />
    </>
  );
};
