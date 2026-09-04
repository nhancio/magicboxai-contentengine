import { useState, useRef, type ReactNode } from "react";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  Share2,
  ThumbsUp,
  ThumbsDown,
  Repeat2,
  MoreHorizontal,
  Search,
  Bell,
  Wifi,
  Battery,
  Signal,
  ChevronLeft,
  ChevronRight,
  Globe2,
  BadgeCheck,
  Layers,
  Sparkles,
} from "lucide-react";
import { cn } from "@shared/lib/utils";
import WebsitePostCard from "../creative/WebsitePostCard";
import BrandedSlide from "../carousel/BrandedSlide";
import type { CarouselAspect, CarouselBrand, CarouselSlideCopy } from "../carousel/types";

export interface IPhoneMockupShowcaseProps {
  creativeMode: "image" | "carousel";
  activeHook: string;
  activeSupporting?: string;
  activeCaption?: string;
  activeHashtags?: string[];
  brand: CarouselBrand;
  brandName: string;
  brandHandle?: string;
  logoUrl?: string;
  imageUrl?: string;
  eyebrow?: string;
  carouselSlides?: CarouselSlideCopy[];
  carouselAspect?: CarouselAspect;
  isGenerating?: boolean;
}

function PhoneStatusBar() {
  return (
    <div className="relative z-30 flex items-center justify-between px-6 pt-3 pb-1 text-[11px] font-semibold text-white">
      <span>9:41</span>
      {/* Dynamic Island */}
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 h-[18px] w-[88px] rounded-full bg-black flex items-center justify-end px-2.5 gap-1.5 shadow-sm">
        <div className="h-2 w-2 rounded-full bg-zinc-800 border border-zinc-700/50" />
        <div className="h-1.5 w-1.5 rounded-full bg-blue-950/80" />
      </div>
      <div className="flex items-center gap-1.5 text-white/90">
        <Signal className="h-3 w-3 fill-current" />
        <Wifi className="h-3 w-3" />
        <Battery className="h-3.5 w-3.5 fill-current" />
      </div>
    </div>
  );
}

function PhoneHomeBar() {
  return (
    <div className="relative z-30 py-2 flex justify-center bg-black/80 backdrop-blur-sm shrink-0">
      <div className="h-1 w-28 rounded-full bg-white/40" />
    </div>
  );
}

function PhoneShell({
  children,
  className,
  isHero = false,
}: {
  children: ReactNode;
  className?: string;
  isHero?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative mx-auto flex flex-col shrink-0 select-none",
        "w-[290px] sm:w-[315px] h-[590px] sm:h-[630px]",
        "rounded-[46px] p-[10px] sm:p-[11px]",
        "bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950",
        "shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.12),inset_0_1px_2px_rgba(255,255,255,0.2)]",
        "transition-all duration-300",
        isHero && "shadow-[0_30px_70px_-10px_rgba(99,102,241,0.25),0_0_0_1px_rgba(255,255,255,0.18)]",
        className,
      )}
    >
      {/* Screen container */}
      <div className="relative flex flex-col h-full w-full rounded-[38px] overflow-hidden bg-black text-white ring-1 ring-white/10">
        <PhoneStatusBar />
        <div className="relative flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
          {children}
        </div>
        <PhoneHomeBar />
      </div>
    </div>
  );
}

/** YouTube Mobile Preview */
function YouTubePhone({
  brand,
  brandName,
  hook,
  supporting,
  imageUrl,
  eyebrow,
}: {
  brand: CarouselBrand;
  brandName: string;
  hook: string;
  supporting?: string;
  imageUrl?: string;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-col min-h-full bg-[#0f0f0f] text-white">
      {/* YouTube App Top Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/10 bg-[#0f0f0f]/95 sticky top-0 z-20 backdrop-blur">
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-6 items-center justify-center rounded bg-[#ff0000] text-[10px] font-black text-white">
            ▶
          </div>
          <span className="text-[14px] font-bold tracking-tighter">YouTube</span>
        </div>
        <div className="flex items-center gap-3 text-white/80">
          <Search className="h-4 w-4" />
          <Bell className="h-4 w-4" />
          <div
            className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white overflow-hidden"
            style={{ background: brand.colors.primary }}
          >
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              brandName.slice(0, 1).toUpperCase()
            )}
          </div>
        </div>
      </div>

      {/* Post Content */}
      <div className="p-3 space-y-2.5">
        {/* Creator header */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden shrink-0 border border-white/20"
            style={{ background: brand.colors.primary }}
          >
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[11px] font-bold">{brandName.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold truncate">{brandName}</span>
              <BadgeCheck className="h-3.5 w-3.5 fill-white text-black shrink-0" />
            </div>
            <p className="text-[10px] text-white/50">2 hours ago</p>
          </div>
          <MoreHorizontal className="h-4 w-4 text-white/50 shrink-0" />
        </div>

        {/* Community Post text */}
        <p className="text-xs leading-relaxed text-white/90">
          <span className="font-semibold text-white block mb-0.5">{hook}</span>
          {supporting && <span className="text-white/75 line-clamp-2">{supporting}</span>}
        </p>

        {/* Media visual card */}
        <div className="rounded-xl overflow-hidden border border-white/10 bg-zinc-900 shadow-md flex justify-center">
          <WebsitePostCard
            brand={brand}
            hook={hook}
            supporting={supporting}
            imageUrl={imageUrl}
            eyebrow={eyebrow}
            scale={268 / 1080}
          />
        </div>

        {/* YouTube engagement bar */}
        <div className="flex items-center justify-between pt-1 border-t border-white/10 text-white/70 text-[11px]">
          <div className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1">
            <ThumbsUp className="h-3.5 w-3.5" />
            <span>1.2K</span>
            <span className="text-white/20 mx-0.5">|</span>
            <ThumbsDown className="h-3.5 w-3.5" />
          </div>
          <div className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1">
            <MessageCircle className="h-3.5 w-3.5" />
            <span>148</span>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1">
            <Share2 className="h-3.5 w-3.5" />
            <span>Share</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Instagram Mobile Preview (Hero) */
function InstagramPhone({
  brand,
  brandName,
  brandHandle,
  hook,
  supporting,
  imageUrl,
  eyebrow,
  hashtags = [],
}: {
  brand: CarouselBrand;
  brandName: string;
  brandHandle?: string;
  hook: string;
  supporting?: string;
  imageUrl?: string;
  eyebrow?: string;
  hashtags?: string[];
}) {
  const handle = brandHandle || brandName.toLowerCase().replace(/\s+/g, "");

  return (
    <div className="flex flex-col min-h-full bg-black text-white">
      {/* Instagram App Top Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/10 bg-black/95 sticky top-0 z-20 backdrop-blur">
        <span className="font-serif italic text-base font-bold tracking-tight">Instagram</span>
        <div className="flex items-center gap-3.5 text-white">
          <Heart className="h-4 w-4" />
          <div className="relative">
            <Send className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-black" />
          </div>
        </div>
      </div>

      {/* Post Creator Bar */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[1.5px]">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black overflow-hidden border border-black"
              style={{ background: brand.colors.primary }}
            >
              {brand.logoUrl ? (
                <img src={brand.logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[10px] font-bold">{brandName.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold leading-none">{handle}</span>
              <BadgeCheck className="h-3 w-3 fill-blue-500 text-black" />
            </div>
            <p className="text-[9px] text-white/50 leading-none mt-0.5">Original audio</p>
          </div>
        </div>
        <MoreHorizontal className="h-4 w-4 text-white/60" />
      </div>

      {/* Main Branded Creative Card */}
      <div className="w-full flex justify-center bg-zinc-950 border-y border-white/5 overflow-hidden">
        <WebsitePostCard
          brand={brand}
          hook={hook}
          supporting={supporting}
          imageUrl={imageUrl}
          eyebrow={eyebrow}
          scale={285 / 1080}
        />
      </div>

      {/* Action Icons */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <Heart className="h-4 w-4 fill-red-500 text-red-500" />
            <MessageCircle className="h-4 w-4" />
            <Send className="h-4 w-4" />
          </div>
          <Bookmark className="h-4 w-4" />
        </div>

        {/* Likes */}
        <p className="text-[11px] font-semibold text-white/90">3,429 likes</p>

        {/* Caption */}
        <div className="text-[11px] leading-relaxed text-white/85">
          <span className="font-semibold text-white mr-1.5">{handle}</span>
          <span>{hook}</span>
          {supporting && <p className="mt-1 text-white/70 line-clamp-2">{supporting}</p>}
          {hashtags.length > 0 && (
            <p className="mt-1 text-blue-400/90 text-[10px]">
              {hashtags.slice(0, 5).map((t) => `#${t.replace(/^#/, "")}`).join(" ")}
            </p>
          )}
        </div>

        <p className="text-[10px] text-white/40">View all 84 comments</p>
        <p className="text-[9px] text-white/30 uppercase tracking-wider">2 hours ago</p>
      </div>
    </div>
  );
}

/** LinkedIn Mobile Preview */
function LinkedInPhone({
  brand,
  brandName,
  hook,
  supporting,
  imageUrl,
  eyebrow,
  hashtags = [],
}: {
  brand: CarouselBrand;
  brandName: string;
  hook: string;
  supporting?: string;
  imageUrl?: string;
  eyebrow?: string;
  hashtags?: string[];
}) {
  return (
    <div className="flex flex-col min-h-full bg-[#1b1f23] text-white">
      {/* LinkedIn App Top Bar */}
      <div className="flex items-center gap-2.5 px-3 py-2 border-b border-white/10 bg-[#1b1f23]/95 sticky top-0 z-20 backdrop-blur">
        <div
          className="h-6 w-6 rounded-full flex items-center justify-center font-bold text-[10px] overflow-hidden"
          style={{ background: brand.colors.primary }}
        >
          {brand.logoUrl ? <img src={brand.logoUrl} alt="" className="h-full w-full object-cover" /> : brandName.slice(0, 1)}
        </div>
        <div className="flex-1 flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/60">
          <Search className="h-3 w-3" />
          <span>Search</span>
        </div>
        <MessageCircle className="h-4 w-4 text-white/70" />
      </div>

      {/* Post Content */}
      <div className="p-3 space-y-2.5">
        {/* Creator header */}
        <div className="flex items-start gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg overflow-hidden shrink-0 border border-white/10 shadow-sm"
            style={{ background: brand.colors.primary }}
          >
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-bold">{brandName.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold truncate leading-tight">{brandName}</div>
            <p className="text-[10px] text-white/60">12,480 followers</p>
            <div className="flex items-center gap-1 text-[9px] text-white/45">
              <span>Just now</span>
              <span>•</span>
              <Globe2 className="h-2.5 w-2.5" />
            </div>
          </div>
          <MoreHorizontal className="h-4 w-4 text-white/50 shrink-0" />
        </div>

        {/* Post Text */}
        <div className="text-xs leading-relaxed text-white/90">
          <p className="font-semibold text-white">{hook}</p>
          {supporting && <p className="mt-1 text-white/75 line-clamp-2">{supporting}</p>}
          {hashtags.length > 0 && (
            <p className="mt-1 text-[#70b5f9] text-[10px]">
              {hashtags.slice(0, 4).map((t) => `#${t.replace(/^#/, "")}`).join(" ")}
            </p>
          )}
        </div>

        {/* Media visual card */}
        <div className="rounded-lg overflow-hidden border border-white/10 bg-zinc-900 shadow-md flex justify-center">
          <WebsitePostCard
            brand={brand}
            hook={hook}
            supporting={supporting}
            imageUrl={imageUrl}
            eyebrow={eyebrow}
            scale={268 / 1080}
          />
        </div>

        {/* LinkedIn Reaction summary */}
        <div className="flex items-center justify-between text-[10px] text-white/55 pt-1 border-b border-white/10 pb-1.5">
          <span className="flex items-center gap-1">
            <span className="h-3.5 w-3.5 rounded-full bg-[#0a66c2] flex items-center justify-center text-[8px] text-white">👍</span>
            <span>248</span>
          </span>
          <span>36 comments · 12 reposts</span>
        </div>

        {/* LinkedIn action bar */}
        <div className="flex items-center justify-around text-white/70 text-[10px] pt-0.5">
          <div className="flex items-center gap-1 hover:text-white cursor-pointer py-1">
            <ThumbsUp className="h-3.5 w-3.5" />
            <span>Like</span>
          </div>
          <div className="flex items-center gap-1 hover:text-white cursor-pointer py-1">
            <MessageCircle className="h-3.5 w-3.5" />
            <span>Comment</span>
          </div>
          <div className="flex items-center gap-1 hover:text-white cursor-pointer py-1">
            <Repeat2 className="h-3.5 w-3.5" />
            <span>Repost</span>
          </div>
          <div className="flex items-center gap-1 hover:text-white cursor-pointer py-1">
            <Send className="h-3.5 w-3.5" />
            <span>Send</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Single Carousel Phone with interactive slides & full vertical scroll */
function CarouselSinglePhone({
  brand,
  brandName,
  brandHandle,
  slides,
  aspect = "4:5",
  activeHook,
  caption,
  hashtags = [],
}: {
  brand: CarouselBrand;
  brandName: string;
  brandHandle?: string;
  slides: CarouselSlideCopy[];
  aspect?: CarouselAspect;
  activeHook: string;
  caption?: string;
  hashtags?: string[];
}) {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const handle = brandHandle || brandName.toLowerCase().replace(/\s+/g, "");
  const total = slides.length || 1;
  const currentSlide = slides[activeSlideIndex] ?? slides[0];

  const nextSlide = () => setActiveSlideIndex((prev) => (prev + 1) % total);
  const prevSlide = () => setActiveSlideIndex((prev) => (prev - 1 + total) % total);

  return (
    <div className="flex flex-col min-h-full bg-black text-white">
      {/* Instagram App Top Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/10 bg-black/95 sticky top-0 z-20 backdrop-blur">
        <div className="flex items-center gap-1.5">
          <span className="font-serif italic text-base font-bold tracking-tight">Instagram</span>
          <span className="rounded-full bg-brand/20 px-1.5 py-0.5 text-[9px] font-semibold text-brand-foreground border border-brand/40">
            Carousel
          </span>
        </div>
        <div className="flex items-center gap-3.5 text-white">
          <Heart className="h-4 w-4" />
          <Send className="h-4 w-4" />
        </div>
      </div>

      {/* Creator Bar */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[1.5px]">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black overflow-hidden border border-black"
              style={{ background: brand.colors.primary }}
            >
              {brand.logoUrl ? (
                <img src={brand.logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[10px] font-bold">{brandName.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold leading-none">{handle}</span>
              <BadgeCheck className="h-3 w-3 fill-blue-500 text-black" />
            </div>
            <p className="text-[9px] text-white/50 leading-none mt-0.5">Multi-slide deck</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-mono font-bold text-white/90">
            {activeSlideIndex + 1}/{total}
          </span>
          <MoreHorizontal className="h-4 w-4 text-white/60" />
        </div>
      </div>

      {/* Interactive Carousel Card with Controls */}
      <div className="relative w-full bg-zinc-950 border-y border-white/5 flex flex-col items-center py-1 group">
        <div className="overflow-hidden rounded-md shadow-lg flex justify-center">
          {currentSlide && (
            <BrandedSlide
              slide={currentSlide}
              brand={brand}
              aspect={aspect}
              index={activeSlideIndex}
              total={total}
              scale={285 / 1080}
            />
          )}
        </div>

        {/* Carousel Slide Navigation Buttons */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={prevSlide}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center backdrop-blur shadow-md transition-all z-10 border border-white/20"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center backdrop-blur shadow-md transition-all z-10 border border-white/20"
              aria-label="Next slide"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Carousel Pagination Dots */}
        {total > 1 && (
          <div className="flex items-center justify-center gap-1.5 py-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveSlideIndex(idx)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  activeSlideIndex === idx
                    ? "w-4 bg-brand"
                    : "w-1.5 bg-white/30 hover:bg-white/50",
                )}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Action Icons */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <Heart className="h-4 w-4 fill-red-500 text-red-500" />
            <MessageCircle className="h-4 w-4" />
            <Send className="h-4 w-4" />
          </div>
          <Bookmark className="h-4 w-4 fill-white text-white" />
        </div>

        {/* Likes */}
        <p className="text-[11px] font-semibold text-white/90">4,120 likes · 892 saves</p>

        {/* Caption */}
        <div className="text-[11px] leading-relaxed text-white/85 space-y-1">
          <p>
            <span className="font-semibold text-white mr-1.5">{handle}</span>
            <span>{activeHook}</span>
          </p>
          {caption && (
            <p className="text-white/70 whitespace-pre-line text-[10px] leading-relaxed">
              {caption}
            </p>
          )}
          {hashtags.length > 0 && (
            <p className="text-blue-400/90 text-[10px] pt-1">
              {hashtags.slice(0, 6).map((t) => `#${t.replace(/^#/, "")}`).join(" ")}
            </p>
          )}
        </div>

        {/* Interactive slide picker bar */}
        <div className="pt-2 border-t border-white/10 space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">
            Slide Navigator (Tap to preview)
          </span>
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {slides.map((slide, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveSlideIndex(idx)}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-medium shrink-0 border transition-all text-left truncate max-w-28",
                  activeSlideIndex === idx
                    ? "border-brand bg-brand/20 text-brand-foreground font-bold"
                    : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
                )}
              >
                {idx + 1}. {slide.title || `Slide ${idx + 1}`}
              </button>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-white/40 pt-1">View all 112 comments</p>
      </div>
    </div>
  );
}

export default function IPhoneMockupShowcase({
  creativeMode,
  activeHook,
  activeSupporting,
  activeCaption,
  activeHashtags = [],
  brand,
  brandName,
  brandHandle,
  imageUrl,
  eyebrow,
  carouselSlides = [],
  carouselAspect = "4:5",
  isGenerating = false,
}: IPhoneMockupShowcaseProps) {
  const [mobileTab, setMobileTab] = useState<"instagram" | "youtube" | "linkedin">("instagram");

  return (
    <div className="w-full space-y-6">
      {/* Mobile Tab Selector (Only shown on smaller screens for image post mode) */}
      {creativeMode === "image" && (
        <div className="flex items-center justify-center lg:hidden">
          <div className="inline-flex rounded-xl bg-secondary/80 p-1 border border-border">
            {(
              [
                ["youtube", "YouTube"],
                ["instagram", "Instagram"],
                ["linkedin", "LinkedIn"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMobileTab(key)}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                  mobileTab === key
                    ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Showcase Stage */}
      {creativeMode === "image" ? (
        <div className="relative py-4 sm:py-6 overflow-hidden">
          {/* Subtle Stage Lighting & Background Glow */}
          <div className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none">
            <div className="h-64 w-[600px] rounded-full bg-brand/10 blur-[100px] opacity-70" />
            <div className="h-48 w-48 rounded-full bg-purple-500/10 blur-[80px] -translate-x-32 opacity-50" />
            <div className="h-48 w-48 rounded-full bg-blue-500/10 blur-[80px] translate-x-32 opacity-50" />
          </div>

          {/* Desktop 3-Phone 3D Showcase */}
          <div className="hidden lg:flex items-center justify-center gap-6 xl:gap-8 perspective-[1200px]">
            {/* Left Phone: YouTube */}
            <div className="transition-all duration-500 transform hover:scale-[1.02] hover:z-30 hover:-translate-y-2">
              <div className="text-center mb-2.5">
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-secondary/60 px-2.5 py-1 rounded-full border border-border/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  YouTube Community
                </span>
              </div>
              <PhoneShell className="shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
                <YouTubePhone
                  brand={brand}
                  brandName={brandName}
                  hook={activeHook}
                  supporting={activeSupporting}
                  imageUrl={imageUrl}
                  eyebrow={eyebrow}
                />
              </PhoneShell>
            </div>

            {/* Middle Phone: Instagram (Hero) */}
            <div className="transition-all duration-500 transform z-20 hover:scale-[1.03] hover:-translate-y-3 -mt-3">
              <div className="text-center mb-2.5">
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider font-semibold text-brand bg-brand/10 px-3 py-1 rounded-full border border-brand/30 shadow-sm">
                  <Sparkles className="h-3 w-3" />
                  Instagram Feed
                </span>
              </div>
              <PhoneShell isHero className="scale-105">
                <InstagramPhone
                  brand={brand}
                  brandName={brandName}
                  brandHandle={brandHandle}
                  hook={activeHook}
                  supporting={activeSupporting}
                  imageUrl={imageUrl}
                  eyebrow={eyebrow}
                  hashtags={activeHashtags}
                />
              </PhoneShell>
            </div>

            {/* Right Phone: LinkedIn */}
            <div className="transition-all duration-500 transform hover:scale-[1.02] hover:z-30 hover:-translate-y-2">
              <div className="text-center mb-2.5">
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-secondary/60 px-2.5 py-1 rounded-full border border-border/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  LinkedIn Feed
                </span>
              </div>
              <PhoneShell className="shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
                <LinkedInPhone
                  brand={brand}
                  brandName={brandName}
                  hook={activeHook}
                  supporting={activeSupporting}
                  imageUrl={imageUrl}
                  eyebrow={eyebrow}
                  hashtags={activeHashtags}
                />
              </PhoneShell>
            </div>
          </div>

          {/* Mobile / Tablet View: Active Selected Tab Phone */}
          <div className="flex lg:hidden justify-center">
            {mobileTab === "youtube" && (
              <PhoneShell>
                <YouTubePhone
                  brand={brand}
                  brandName={brandName}
                  hook={activeHook}
                  supporting={activeSupporting}
                  imageUrl={imageUrl}
                  eyebrow={eyebrow}
                />
              </PhoneShell>
            )}
            {mobileTab === "instagram" && (
              <PhoneShell isHero>
                <InstagramPhone
                  brand={brand}
                  brandName={brandName}
                  brandHandle={brandHandle}
                  hook={activeHook}
                  supporting={activeSupporting}
                  imageUrl={imageUrl}
                  eyebrow={eyebrow}
                  hashtags={activeHashtags}
                />
              </PhoneShell>
            )}
            {mobileTab === "linkedin" && (
              <PhoneShell>
                <LinkedInPhone
                  brand={brand}
                  brandName={brandName}
                  hook={activeHook}
                  supporting={activeSupporting}
                  imageUrl={imageUrl}
                  eyebrow={eyebrow}
                  hashtags={activeHashtags}
                />
              </PhoneShell>
            )}
          </div>
        </div>
      ) : (
        /* Carousel Mode: 1 Single Interactive iPhone Screen */
        <div className="relative py-4 sm:py-6 flex flex-col items-center justify-center">
          <div className="text-center mb-3">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider font-semibold text-brand bg-brand/10 px-3 py-1 rounded-full border border-brand/30">
              <Layers className="h-3.5 w-3.5" />
              Interactive Multi-Slide Carousel ({carouselSlides.length || 5} slides)
            </span>
          </div>

          <PhoneShell isHero className="scale-100 sm:scale-105">
            <CarouselSinglePhone
              brand={brand}
              brandName={brandName}
              brandHandle={brandHandle}
              slides={carouselSlides}
              aspect={carouselAspect}
              activeHook={activeHook}
              caption={activeCaption}
              hashtags={activeHashtags}
            />
          </PhoneShell>
        </div>
      )}
    </div>
  );
}
