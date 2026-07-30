/** Shared types for the branded carousel layering system. */

export type CarouselPlatform = "linkedin" | "instagram" | "facebook" | "twitter" | "whatsapp";

export type CarouselAspect = "1:1" | "4:5" | "16:9";

export type TitleSegment =
  | { type: "text"; value: string }
  | { type: "highlight"; value: string };

export type SlideRole = "hook" | "point" | "cta";

export interface CarouselSlideCopy {
  role: SlideRole;
  /** Plain title for editors / a11y */
  title: string;
  /** Rendered title with optional highlight spans */
  titleSegments: TitleSegment[];
  body: string;
}

export interface CarouselBrand {
  name: string;
  logoUrl?: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    muted: string;
  };
}

export interface CarouselPack {
  topic: string;
  caption: string;
  hashtags: string[];
  hookFamily?: string;
  trendUsed?: string;
  whySave?: string;
  slides: CarouselSlideCopy[];
}

export const ASPECT_SIZE: Record<CarouselAspect, { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "16:9": { w: 1080, h: 608 },
};

export const PLATFORM_ASPECT: Record<CarouselPlatform, CarouselAspect> = {
  // 4:5 occupies more feed real estate while remaining accepted by both
  // platforms. X/Facebook/WhatsApp keep the broadly portable square.
  linkedin: "4:5",
  instagram: "4:5",
  facebook: "1:1",
  twitter: "1:1",
  whatsapp: "1:1",
};

export function defaultBrand(overrides?: Partial<CarouselBrand>): CarouselBrand {
  return {
    name: overrides?.name ?? "Your Brand",
    logoUrl: overrides?.logoUrl,
    colors: {
      primary: overrides?.colors?.primary ?? "#0b1b3a",
      secondary: overrides?.colors?.secondary ?? "#8b7cf6",
      accent: overrides?.colors?.accent ?? "#7dd3fc",
      text: overrides?.colors?.text ?? "#ffffff",
      muted: overrides?.colors?.muted ?? "rgba(255,255,255,0.78)",
    },
  };
}
