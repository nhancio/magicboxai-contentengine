/**
 * Basic layering framework for carousel slides.
 *
 * Each slide is a stack of absolute layers with fixed geometry so logo,
 * brand name, chevrons, and typography land in the same place on every card.
 * Swap themes by changing tokens — never by moving layers.
 */

import type { CSSProperties, ReactNode } from "react";
import type { CarouselBrand } from "./types";

export type LayerId =
  | "background"
  | "stripes"
  | "glow"
  | "chevronsTop"
  | "chevronsBottom"
  | "logo"
  | "brandName"
  | "title"
  | "body"
  | "footer";

const LAYER_Z: Record<LayerId, number> = {
  background: 0,
  stripes: 1,
  glow: 2,
  chevronsTop: 3,
  chevronsBottom: 3,
  logo: 4,
  brandName: 4,
  title: 5,
  body: 5,
  footer: 5,
};

/** Fixed layout tokens as % of slide — keep identical across all slides. */
export const LAYOUT = {
  paddingX: "9%",
  logo: { top: "6.5%", left: "7%", size: "7.2%" },
  brandName: { top: "7.8%", left: "16%", fontSize: "2.4%" },
  chevronsTop: { top: "7%", right: "7%", fontSize: "4.2%" },
  chevronsBottom: { bottom: "7%", left: "7%", size: "5.5%" },
  title: { top: "32%", fontSize: "5.6%", lineHeight: 1.15 },
  body: { top: "58%", fontSize: "2.35%", lineHeight: 1.45, maxWidth: "78%" },
  footer: { bottom: "7%", right: "7%", fontSize: "2%" },
} as const;

export function Layer({
  id,
  children,
  style,
  className,
}: {
  id: LayerId;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      data-layer={id}
      className={className}
      style={{
        position: "absolute",
        zIndex: LAYER_Z[id],
        pointerEvents: "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function BackgroundLayer({ brand }: { brand: CarouselBrand }) {
  return (
    <Layer
      id="background"
      style={{
        inset: 0,
        background: brand.colors.primary,
      }}
    />
  );
}

/** Diagonal brand stripes — matches the study-abroad carousel look. */
export function StripesLayer({ brand }: { brand: CarouselBrand }) {
  const a = brand.colors.secondary;
  const b = brand.colors.accent;
  return (
    <Layer id="stripes" style={{ inset: 0, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: "-10%",
          right: "-5%",
          width: "55%",
          height: "70%",
          background: `linear-gradient(135deg, ${a} 0%, ${b} 100%)`,
          transform: "skewY(-18deg)",
          opacity: 0.95,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "8%",
          right: "8%",
          width: "42%",
          height: "48%",
          background: `linear-gradient(145deg, ${b}cc 0%, ${a}99 100%)`,
          transform: "skewY(-18deg)",
          opacity: 0.85,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-15%",
          left: "-10%",
          width: "60%",
          height: "45%",
          background: `linear-gradient(45deg, ${a}55 0%, transparent 70%)`,
          transform: "skewY(-12deg)",
        }}
      />
    </Layer>
  );
}

export function GlowLayer({ brand }: { brand: CarouselBrand }) {
  return (
    <Layer
      id="glow"
      style={{
        inset: 0,
        background: `radial-gradient(ellipse at 70% 20%, ${brand.colors.accent}33 0%, transparent 55%)`,
      }}
    />
  );
}

export function ChevronsTopLayer({ brand }: { brand: CarouselBrand }) {
  return (
    <Layer
      id="chevronsTop"
      style={{
        top: LAYOUT.chevronsTop.top,
        right: LAYOUT.chevronsTop.right,
        color: brand.colors.accent,
        fontSize: LAYOUT.chevronsTop.fontSize,
        fontWeight: 700,
        letterSpacing: "-0.08em",
        lineHeight: 1,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {">>>"}
    </Layer>
  );
}

export function ChevronsBottomLayer({ brand }: { brand: CarouselBrand }) {
  return (
    <Layer
      id="chevronsBottom"
      style={{
        bottom: LAYOUT.chevronsBottom.bottom,
        left: LAYOUT.chevronsBottom.left,
        width: LAYOUT.chevronsBottom.size,
        height: LAYOUT.chevronsBottom.size,
        color: brand.colors.accent,
      }}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
        <path d="M8 5l7 7-7 7V5z" opacity="0.55" />
        <path d="M3 5l7 7-7 7V5z" />
      </svg>
    </Layer>
  );
}

export function LogoLayer({ brand }: { brand: CarouselBrand }) {
  if (!brand.logoUrl) return null;
  return (
    <Layer
      id="logo"
      style={{
        top: LAYOUT.logo.top,
        left: LAYOUT.logo.left,
        width: LAYOUT.logo.size,
        height: LAYOUT.logo.size,
        borderRadius: "18%",
        overflow: "hidden",
        background: "rgba(255,255,255,0.12)",
      }}
    >
      <img
        src={brand.logoUrl}
        alt=""
        crossOrigin="anonymous"
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </Layer>
  );
}

export function BrandNameLayer({ brand }: { brand: CarouselBrand }) {
  const left = brand.logoUrl ? LAYOUT.brandName.left : LAYOUT.logo.left;
  return (
    <Layer
      id="brandName"
      style={{
        top: LAYOUT.brandName.top,
        left,
        color: brand.colors.text,
        fontSize: LAYOUT.brandName.fontSize,
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        fontFamily: "system-ui, sans-serif",
        opacity: 0.92,
        maxWidth: "50%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {brand.name}
    </Layer>
  );
}
