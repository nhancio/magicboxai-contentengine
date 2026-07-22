// Platform-accurate post previews — the surface that sells the product.
// Each mockup mirrors the real platform's post anatomy so an enterprise
// buyer instantly recognizes how their content will land.

import type { SocialPlatform } from"@shared/types";
import {
 BadgeCheck,
 Bookmark,
 Globe2,
 Heart,
 MessageCircle,
 MoreHorizontal,
 Repeat2,
 Send,
 ThumbsUp,
} from"lucide-react";

export interface PreviewContent {
 caption: string;
 hashtags?: string[];
 imageUrl?: string;
 brandName?: string;
 handle?: string;
 logoUrl?: string;
 /** Fetched brand palette — used when no imageUrl is available. */
 brandColors?: { primary?: string; secondary?: string; accent?: string };
}

function BrandAvatar({ content, className }: { content: PreviewContent; className: string }) {
 if (content.logoUrl) {
 return <img src={content.logoUrl} alt="" className={`${className} object-cover`} />;
 }
 const letter = (content.brandName ??"B").charAt(0).toUpperCase();
 const bg = content.brandColors?.primary ?? undefined;
 return (
 <div
 className={`${className} flex items-center justify-center font-semibold text-white`}
 style={{ background: bg || undefined }}
 >
 {!bg && (
 <span className="flex h-full w-full items-center justify-center rounded-[inherit] bg-brand text-brand-foreground">
 {letter}
 </span>
 )}
 {bg && letter}
 </div>
 );
}

function MediaSlot({ content, aspect }: { content: PreviewContent; aspect: string }) {
 if (content.imageUrl) {
 return <img src={content.imageUrl} alt="" className={`w-full ${aspect} object-cover`} />;
 }
 const primary = content.brandColors?.primary || "#7c3aed";
 const secondary = content.brandColors?.secondary || "#1e1b4b";
 const accent = content.brandColors?.accent || primary;
 return (
 <div
 className={`relative w-full ${aspect} flex flex-col items-center justify-center gap-3 overflow-hidden`}
 style={{
 background: `linear-gradient(145deg, ${primary} 0%, ${secondary} 55%, ${accent} 100%)`,
 }}
 >
 <div className="absolute inset-0 opacity-30" style={{
 backgroundImage:
 "radial-gradient(circle at 30% 20%, rgba(255,255,255,.45), transparent 42%), radial-gradient(circle at 80% 70%, rgba(0,0,0,.25), transparent 40%)",
 }} />
 {content.logoUrl ? (
 <img
 src={content.logoUrl}
 alt=""
 className="relative z-[1] h-16 w-16 rounded-2xl bg-white/90 object-contain p-2 shadow-lg"
 />
 ) : (
 <div className="relative z-[1] flex h-16 w-16 items-center justify-center rounded-2xl bg-white/90 font-display text-2xl text-zinc-900 shadow-lg">
 {(content.brandName || "M").charAt(0).toUpperCase()}
 </div>
 )}
 <span className="relative z-[1] max-w-[80%] text-center text-[11px] font-medium text-white/90 drop-shadow">
 {content.brandName || "Your brand"}
 </span>
 </div>
 );
}

function formatHashtags(tags?: string[]) {
  if (!tags?.length) return "";
  return tags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ");
}

export function InstagramPreview({ content }: { content: PreviewContent }) {
 const tags = formatHashtags(content.hashtags);
 return (
 <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-800 bg-black text-white shadow-xl">
 <div className="flex items-center gap-2.5 px-3.5 py-2.5">
 <div className="rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[2px]">
 <BrandAvatar content={content} className="h-7 w-7 rounded-full border-2 border-black" />
 </div>
 <span className="text-[13px] font-semibold text-white">
 {content.handle ?? content.brandName ?? "yourbrand"}
 </span>
 <MoreHorizontal className="ml-auto h-4 w-4 text-zinc-400" />
 </div>
 <MediaSlot content={content} aspect="aspect-square" />
 <div className="space-y-1.5 px-3.5 py-3 text-white">
 <div className="flex items-center gap-4 text-white">
 <Heart className="h-[22px] w-[22px]" />
 <MessageCircle className="h-[22px] w-[22px]" />
 <Send className="h-[22px] w-[22px]" />
 <Bookmark className="ml-auto h-[22px] w-[22px]" />
 </div>
 <p className="text-[13px] leading-snug">
 <span className="font-semibold">{content.handle ?? content.brandName ?? "yourbrand"} </span>
 <span className="whitespace-pre-line text-zinc-100">{content.caption}</span>
 {tags && <span className="text-[#8ab4f8]"> {tags}</span>}
 </p>
 </div>
 </div>
 );
}

export function TwitterPreview({ content }: { content: PreviewContent }) {
 return (
 <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-black p-4 text-white shadow-xl">
 <div className="flex gap-3">
 <BrandAvatar content={content} className="h-10 w-10 shrink-0 rounded-full" />
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-1 text-[14px]">
 <span className="truncate font-bold text-white">{content.brandName ?? "Your Brand"}</span>
 <BadgeCheck className="h-4 w-4 shrink-0 fill-[#1d9bf0] text-black" />
 <span className="truncate text-zinc-400">
 @{content.handle ?? "yourbrand"} · now
 </span>
 </div>
 <p className="mt-0.5 whitespace-pre-line text-[14px] leading-snug text-zinc-100">
 {content.caption}
 </p>
 {content.imageUrl && (
 <img
 src={content.imageUrl}
 alt=""
 className="mt-3 w-full rounded-xl border border-zinc-700 object-cover"
 />
 )}
 <div className="mt-3 flex items-center justify-between pr-8 text-zinc-400">
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
 <div className="w-full max-w-sm overflow-hidden rounded-xl border border-zinc-700 bg-[#1b1f23] text-white shadow-xl">
 <div className="flex items-start gap-2.5 px-4 pt-3.5">
 <BrandAvatar content={content} className="h-11 w-11 shrink-0 rounded-full" />
 <div className="min-w-0">
 <div className="text-[13px] font-semibold leading-tight text-white">
 {content.brandName ?? "Your Brand"}
 </div>
 <div className="text-[11px] text-zinc-400">12,480 followers</div>
 <div className="flex items-center gap-1 text-[11px] text-zinc-400">
 now · <Globe2 className="h-3 w-3" />
 </div>
 </div>
 <MoreHorizontal className="ml-auto h-4 w-4 shrink-0 text-zinc-400" />
 </div>
 <p className="whitespace-pre-line px-4 py-3 text-[13px] leading-relaxed text-zinc-100">
 {content.caption}
 {content.hashtags?.length ? (
 <span className="text-[#70b5f9]">
 {" "}
 {formatHashtags(content.hashtags)}
 </span>
 ) : null}
 </p>
 <MediaSlot content={content} aspect="aspect-[1.91/1]" />
 <div className="mx-4 flex items-center justify-around border-t border-zinc-700 py-1.5 text-zinc-400">
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

export function YouTubePreview({ content }: { content: PreviewContent }) {
 const [title, ...rest] = content.caption.split("\n");
 const description = rest.join("\n").trim();
 return (
 <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-800 bg-black text-white shadow-xl">
 <div className="relative">
 <MediaSlot content={content} aspect="aspect-video" />
 <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white">
 0:30
 </span>
 </div>
 <div className="flex gap-3 px-3.5 py-3">
 <BrandAvatar content={content} className="h-9 w-9 shrink-0 rounded-full" />
 <div className="min-w-0">
 <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-white">
 {title || "Your video title"}
 </p>
 <p className="mt-0.5 text-[11px] text-zinc-400">
 {content.brandName ?? "Your Brand"} · just now
 </p>
 {description && (
 <p className="mt-1 line-clamp-2 whitespace-pre-line text-[11px] leading-snug text-zinc-400">
 {description}
 </p>
 )}
 </div>
 <MoreHorizontal className="ml-auto h-4 w-4 shrink-0 text-zinc-400" />
 </div>
 </div>
 );
}

export function FacebookPreview({ content }: { content: PreviewContent }) {
 return (
 <div className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-white text-zinc-900 shadow-2xl">
 <div className="flex items-start gap-2.5 px-4 pt-3.5">
 <BrandAvatar content={content} className="h-10 w-10 shrink-0 rounded-full" />
 <div className="min-w-0">
 <div className="text-[13px] font-semibold leading-tight">
 {content.brandName ?? "Your Brand"}
 </div>
 <div className="text-[11px] text-zinc-500">Just now · Public</div>
 </div>
 <MoreHorizontal className="ml-auto h-4 w-4 shrink-0 text-zinc-400" />
 </div>
 <p className="whitespace-pre-line px-4 py-3 text-[14px] leading-relaxed">
 {content.caption}
 {content.hashtags?.length ? (
 <span className="text-[#0866ff]">
 {" "}
 {formatHashtags(content.hashtags)}
 </span>
 ) : null}
 </p>
 <MediaSlot content={content} aspect="aspect-[1.91/1]" />
 <div className="mx-4 flex items-center justify-around border-t border-zinc-200 py-1.5 text-zinc-500">
 {[
 { icon: ThumbsUp, label: "Like" },
 { icon: MessageCircle, label: "Comment" },
 { icon: Send, label: "Share" },
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
 case "youtube":
 return <YouTubePreview content={content} />;
 case "facebook":
 return <FacebookPreview content={content} />;
 default:
 return <LinkedInPreview content={content} />;
 }
}
