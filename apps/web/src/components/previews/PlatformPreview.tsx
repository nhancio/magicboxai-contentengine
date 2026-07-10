// Platform-accurate post previews — the surface that sells the product.
// Each mockup mirrors the real platform's post anatomy so an enterprise
// buyer instantly recognizes how their content will land.

import type { SocialPlatform } from "@shared/types";
import {
  BadgeCheck,
  Bookmark,
  Globe2,
  Heart,
  ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Send,
  ThumbsUp,
} from "lucide-react";

export interface PreviewContent {
  caption: string;
  hashtags?: string[];
  imageUrl?: string;
  brandName?: string;
  handle?: string;
  logoUrl?: string;
}

function BrandAvatar({ content, className }: { content: PreviewContent; className: string }) {
  if (content.logoUrl) {
    return <img src={content.logoUrl} alt="" className={`${className} object-cover`} />;
  }
  const letter = (content.brandName ?? "B").charAt(0).toUpperCase();
  return (
    <div
      className={`${className} flex items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-600 text-white font-semibold`}
    >
      {letter}
    </div>
  );
}

function MediaSlot({ content, aspect }: { content: PreviewContent; aspect: string }) {
  if (content.imageUrl) {
    return <img src={content.imageUrl} alt="" className={`w-full ${aspect} object-cover`} />;
  }
  return (
    <div
      className={`w-full ${aspect} flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-violet-600/20 via-zinc-900 to-indigo-600/20`}
    >
      <ImageIcon className="h-7 w-7 text-white/25" />
      <span className="text-[11px] text-white/30">AI image generated at post time</span>
    </div>
  );
}

export function InstagramPreview({ content }: { content: PreviewContent }) {
  const tags = (content.hashtags ?? []).map((t) => `#${t}`).join(" ");
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-black text-white shadow-2xl">
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <div className="rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[2px]">
          <BrandAvatar content={content} className="h-7 w-7 rounded-full border-2 border-black" />
        </div>
        <span className="text-[13px] font-semibold">
          {content.handle ?? content.brandName ?? "yourbrand"}
        </span>
        <MoreHorizontal className="ml-auto h-4 w-4 text-white/60" />
      </div>
      <MediaSlot content={content} aspect="aspect-square" />
      <div className="space-y-1.5 px-3.5 py-3">
        <div className="flex items-center gap-4">
          <Heart className="h-[22px] w-[22px]" />
          <MessageCircle className="h-[22px] w-[22px]" />
          <Send className="h-[22px] w-[22px]" />
          <Bookmark className="ml-auto h-[22px] w-[22px]" />
        </div>
        <p className="text-[13px] leading-snug">
          <span className="font-semibold">{content.handle ?? content.brandName ?? "yourbrand"}</span>{" "}
          <span className="whitespace-pre-line text-white/90">{content.caption}</span>
          {tags && <span className="text-[#8ab4f8]"> {tags}</span>}
        </p>
      </div>
    </div>
  );
}

export function TwitterPreview({ content }: { content: PreviewContent }) {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-black p-4 text-white shadow-2xl">
      <div className="flex gap-3">
        <BrandAvatar content={content} className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[14px]">
            <span className="truncate font-bold">{content.brandName ?? "Your Brand"}</span>
            <BadgeCheck className="h-4 w-4 shrink-0 fill-[#1d9bf0] text-black" />
            <span className="truncate text-white/50">
              @{content.handle ?? "yourbrand"} · now
            </span>
          </div>
          <p className="mt-0.5 whitespace-pre-line text-[14px] leading-snug text-white/95">
            {content.caption}
          </p>
          {content.imageUrl && (
            <img
              src={content.imageUrl}
              alt=""
              className="mt-3 w-full rounded-xl border border-white/10 object-cover"
            />
          )}
          <div className="mt-3 flex items-center justify-between pr-8 text-white/50">
            <MessageCircle className="h-4 w-4" />
            <Repeat2 className="h-4 w-4" />
            <Heart className="h-4 w-4" />
            <Bookmark className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function LinkedInPreview({ content }: { content: PreviewContent }) {
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-xl border border-white/10 bg-[#1b1f23] text-white shadow-2xl">
      <div className="flex items-start gap-2.5 px-4 pt-3.5">
        <BrandAvatar content={content} className="h-11 w-11 shrink-0 rounded-full" />
        <div className="min-w-0">
          <div className="text-[13px] font-semibold leading-tight">
            {content.brandName ?? "Your Brand"}
          </div>
          <div className="text-[11px] text-white/50">12,480 followers</div>
          <div className="flex items-center gap-1 text-[11px] text-white/50">
            now · <Globe2 className="h-3 w-3" />
          </div>
        </div>
        <MoreHorizontal className="ml-auto h-4 w-4 shrink-0 text-white/50" />
      </div>
      <p className="whitespace-pre-line px-4 py-3 text-[13px] leading-relaxed text-white/90">
        {content.caption}
        {content.hashtags?.length ? (
          <span className="text-[#70b5f9]">
            {" "}
            {content.hashtags.map((t) => `#${t}`).join(" ")}
          </span>
        ) : null}
      </p>
      {content.imageUrl && <img src={content.imageUrl} alt="" className="w-full object-cover" />}
      <div className="mx-4 flex items-center justify-around border-t border-white/10 py-1.5 text-white/60">
        {[
          { icon: ThumbsUp, label: "Like" },
          { icon: MessageCircle, label: "Comment" },
          { icon: Repeat2, label: "Repost" },
          { icon: Send, label: "Send" },
        ].map(({ icon: Icon, label }) => (
          <span key={label} className="flex items-center gap-1.5 px-2 py-1.5 text-[12px]">
            <Icon className="h-4 w-4" /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function PlatformPreview({
  platform,
  content,
}: {
  platform: SocialPlatform;
  content: PreviewContent;
}) {
  switch (platform) {
    case "instagram":
      return <InstagramPreview content={content} />;
    case "twitter":
      return <TwitterPreview content={content} />;
    case "linkedin":
      return <LinkedInPreview content={content} />;
    default:
      return null;
  }
}
