import {
  BackgroundLayer,
  BrandNameLayer,
  ChevronsBottomLayer,
  ChevronsTopLayer,
  GlowLayer,
  Layer,
  LAYOUT,
  LogoLayer,
  StripesLayer,
} from "./layers";
import type {
  CarouselAspect,
  CarouselBrand,
  CarouselSlideCopy,
  TitleSegment,
} from "./types";
import { ASPECT_SIZE } from "./types";

function TitleLine({
  segments,
  brand,
}: {
  segments: TitleSegment[];
  brand: CarouselBrand;
}) {
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "highlight" ? (
          <span key={i} style={{ color: brand.colors.accent }}>
            {seg.value}
            {i < segments.length - 1 ? " " : ""}
          </span>
        ) : (
          <span key={i} style={{ color: brand.colors.text }}>
            {seg.value}
            {i < segments.length - 1 ? " " : ""}
          </span>
        ),
      )}
    </>
  );
}

export default function BrandedSlide({
  slide,
  brand,
  aspect = "1:1",
  index,
  total,
  /** Preview scale in the UI (export uses scale=1 at full pixel size). */
  scale = 1,
  slideRef,
}: {
  slide: CarouselSlideCopy;
  brand: CarouselBrand;
  aspect?: CarouselAspect;
  index: number;
  total: number;
  scale?: number;
  slideRef?: (el: HTMLDivElement | null) => void;
}) {
  const { w, h } = ASPECT_SIZE[aspect];
  const segments =
    slide.titleSegments?.length > 0
      ? slide.titleSegments
      : ([{ type: "text", value: slide.title }] as TitleSegment[]);

  return (
    <div
      style={{
        width: w * scale,
        height: h * scale,
        position: "relative",
        flexShrink: 0,
      }}
    >
      <div
        ref={slideRef}
        data-carousel-slide={index}
        style={{
          width: w,
          height: h,
          position: "absolute",
          top: 0,
          left: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          overflow: "hidden",
          borderRadius: 4,
          fontFamily:
            '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
        }}
      >
        <BackgroundLayer brand={brand} />
        <StripesLayer brand={brand} />
        <GlowLayer brand={brand} />
        <ChevronsTopLayer brand={brand} />
        <ChevronsBottomLayer brand={brand} />
        <LogoLayer brand={brand} />
        <BrandNameLayer brand={brand} />

        <Layer
          id="title"
          style={{
            top: LAYOUT.title.top,
            left: LAYOUT.paddingX,
            right: LAYOUT.paddingX,
            fontSize: LAYOUT.title.fontSize,
            lineHeight: LAYOUT.title.lineHeight,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
            textAlign: "center",
          }}
        >
          <TitleLine segments={segments} brand={brand} />
        </Layer>

        {slide.body ? (
          <Layer
            id="body"
            style={{
              top: LAYOUT.body.top,
              left: "50%",
              transform: "translateX(-50%)",
              width: LAYOUT.body.maxWidth,
              fontSize: LAYOUT.body.fontSize,
              lineHeight: LAYOUT.body.lineHeight,
              color: brand.colors.muted,
              textAlign: "center",
              fontWeight: 400,
            }}
          >
            {slide.body}
          </Layer>
        ) : null}

        <Layer
          id="footer"
          style={{
            bottom: LAYOUT.footer.bottom,
            right: LAYOUT.footer.right,
            fontSize: LAYOUT.footer.fontSize,
            color: brand.colors.accent,
            fontWeight: 600,
            letterSpacing: "0.08em",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {index + 1}/{total}
        </Layer>
      </div>
    </div>
  );
}
