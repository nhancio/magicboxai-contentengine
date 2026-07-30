import type { CarouselBrand } from "../carousel/types";

const WIDTH = 1080;
const HEIGHT = 1350;

function readableText(hex: string): string {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return "#ffffff";
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#171614" : "#ffffff";
}

/**
 * A deterministic, publishable 4:5 creative built from the customer's website
 * image, logo, palette, and approved hook. AI writes the idea; this component
 * owns typography so generators never have to draw brittle text or logos.
 */
export default function WebsitePostCard({
  brand,
  hook,
  supporting,
  imageUrl,
  eyebrow,
  scale = 1,
  cardRef,
}: {
  brand: CarouselBrand;
  hook: string;
  supporting?: string;
  imageUrl?: string;
  eyebrow?: string;
  scale?: number;
  cardRef?: (element: HTMLDivElement | null) => void;
}) {
  const accentText = readableText(brand.colors.accent);

  return (
    <div
      style={{
        width: WIDTH * scale,
        height: HEIGHT * scale,
        position: "relative",
        flexShrink: 0,
      }}
    >
      <div
        ref={cardRef}
        data-website-post-card
        style={{
          width: WIDTH,
          height: HEIGHT,
          position: "absolute",
          inset: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          overflow: "hidden",
          borderRadius: 8,
          background: brand.colors.primary,
          color: "#ffffff",
          fontFamily: '"Instrument Sans", "Segoe UI", sans-serif',
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(145deg, ${brand.colors.primary}, ${brand.colors.secondary})`,
            }}
          />
        )}

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(10,10,10,.52) 0%, rgba(10,10,10,.08) 34%, rgba(10,10,10,.24) 56%, rgba(10,10,10,.94) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            boxShadow: `inset 0 0 0 18px ${brand.colors.accent}`,
            opacity: 0.92,
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 66,
            left: 72,
            right: 72,
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          {brand.logoUrl ? (
            <div
              style={{
                width: 92,
                height: 92,
                padding: 14,
                borderRadius: 22,
                background: "rgba(255,255,255,.94)",
                boxShadow: "0 14px 40px rgba(0,0,0,.2)",
              }}
            >
              <img
                src={brand.logoUrl}
                alt=""
                crossOrigin="anonymous"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </div>
          ) : null}
          <div
            style={{
              minWidth: 0,
              fontSize: 31,
              lineHeight: 1.1,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              textShadow: "0 2px 18px rgba(0,0,0,.55)",
            }}
          >
            {brand.name}
          </div>
          <div
            style={{
              marginLeft: "auto",
              borderRadius: 999,
              padding: "13px 22px",
              background: brand.colors.accent,
              color: accentText,
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            From the brand
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 78,
            right: 78,
            bottom: 86,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
              color: brand.colors.accent,
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            <span style={{ width: 46, height: 3, background: brand.colors.accent }} />
            {eyebrow || "A useful idea"}
          </div>
          <div
            style={{
              maxWidth: 900,
              fontFamily: '"Instrument Serif", Georgia, serif',
              fontSize: hook.length > 80 ? 67 : hook.length > 50 ? 76 : 86,
              lineHeight: 1.02,
              fontWeight: 600,
              letterSpacing: "-0.035em",
              textWrap: "balance",
              textShadow: "0 4px 30px rgba(0,0,0,.62)",
            }}
          >
            {hook}
          </div>
          {supporting ? (
            <div
              style={{
                maxWidth: 860,
                marginTop: 28,
                fontSize: 29,
                lineHeight: 1.42,
                fontWeight: 500,
                color: "rgba(255,255,255,.82)",
                textShadow: "0 2px 18px rgba(0,0,0,.6)",
              }}
            >
              {supporting}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
