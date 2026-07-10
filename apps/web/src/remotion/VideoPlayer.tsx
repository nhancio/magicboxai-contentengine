import React, { useMemo } from "react";
import { Player } from "@remotion/player";
import { ProductShowcase } from "./compositions/ProductShowcase";
import { TestimonialStyle } from "./compositions/TestimonialStyle";
import { BeforeAfter } from "./compositions/BeforeAfter";
import { VIDEO_WIDTH, VIDEO_HEIGHT, VIDEO_FPS, type VideoProps } from "./schema";

export type TemplateId = "ProductShowcase" | "TestimonialStyle" | "BeforeAfter";

interface VideoPlayerProps {
  templateId: TemplateId;
  props: VideoProps;
  /** Player width in CSS pixels (height is auto-calculated from aspect ratio) */
  width?: number;
  style?: React.CSSProperties;
}

const TEMPLATE_MAP: Record<TemplateId, React.FC<VideoProps>> = {
  ProductShowcase,
  TestimonialStyle,
  BeforeAfter,
};

/**
 * Maps existing template IDs from the VIRAL_TEMPLATES list to Remotion composition IDs.
 * Returns null for templates without a Remotion composition (they'll get a fallback).
 */
export function mapTemplateToComposition(templateId: string): TemplateId | null {
  const mapping: Record<string, TemplateId> = {
    "template-product-explanation": "ProductShowcase",
    "template-problem-solution": "ProductShowcase",
    "template-3-reasons": "ProductShowcase",
    "template-unboxing": "ProductShowcase",
    "template-comparison": "ProductShowcase",
    "template-storytime": "TestimonialStyle",
    "template-get-ready-with-me": "TestimonialStyle",
    "template-day-in-my-life": "TestimonialStyle",
    "template-pov": "TestimonialStyle",
    "template-hot-take": "TestimonialStyle",
    "template-before-after": "BeforeAfter",
  };
  return mapping[templateId] || "ProductShowcase";
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  templateId,
  props,
  width = 280,
  style,
}) => {
  const Component = TEMPLATE_MAP[templateId] || ProductShowcase;

  // Remotion Player requires stable inputProps reference
  const inputProps = useMemo(() => ({ ...props }), [
    props.avatarUrl,
    props.avatarName,
    props.productImageUrl,
    props.productName,
    props.hook,
    props.script,
    props.cta,
    JSON.stringify(props.captions),
    props.brandColor,
    props.platform,
    props.tone,
  ]);

  return (
    <div style={style}>
      <Player
        component={Component}
        inputProps={inputProps}
        durationInFrames={450}
        compositionWidth={VIDEO_WIDTH}
        compositionHeight={VIDEO_HEIGHT}
        fps={VIDEO_FPS}
        style={{
          width,
          height: width * (VIDEO_HEIGHT / VIDEO_WIDTH),
          borderRadius: 12,
          overflow: "hidden",
        }}
        controls
        autoPlay
        loop
      />
    </div>
  );
};
