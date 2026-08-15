// Platform-accurate post previews — the surface that sells the product.
// Each mockup mirrors the real platform's post anatomy so an enterprise
// buyer instantly recognizes how their content will land.

import { useEffect, useState, type ReactNode } from"react";
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
 /** When present, the media slot plays this video (thumbnail via imageUrl). */
 videoUrl?: string;
 /** Live node rendered inside the media slot (e.g. a carousel slide). Wins over image/video. */
 mediaNode?: ReactNode;
 /** Finished creative ratio. Lets 4:5 feed work display without square cropping. */
 mediaAspect?: "1:1" | "4:5" | "16:9";
 brandName?: string;
 handle?: string;
 logoUrl?: string;
 /** Fetched brand palette — used when no imageUrl is available. */
 brandColors?: { primary?: string; secondary?: string; accent?: string };
}

function BrandAvatar({ content, className }: { content: PreviewContent; className: string }) {
 const [logoFailed, setLogoFailed] = useState(false);
 useEffect(() => setLogoFailed(false), [content.logoUrl]);
 if (content.logoUrl && !logoFailed) {
 return (
 <img
 src={content.logoUrl}
 alt=""
 className={`${className} object-cover`}
 onError={() => setLogoFailed(true)}
 />
 );
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

/**
 * Inline post image (Twitter/WhatsApp bubble). Renders nothing when the post
 * has no image, and swaps to the channel icon when the image fails to load.
 */
function InlineMedia({
 content,
 imgClassName,
 fallbackClassName,
}: {
 content: PreviewContent;
 imgClassName: string;
 fallbackClassName: string;
}) {
 const [imgFailed, setImgFailed] = useState(false);
 useEffect(() => setImgFailed(false), [content.imageUrl]);
 if (!content.imageUrl) return null;
 if (imgFailed) {
 return (
 <div className={`flex items-center justify-center bg-zinc-900 ${fallbackClassName}`}>
 <BrandAvatar content={content} className="h-14 w-14 rounded-2xl" />
 </div>
 );
 }
 return (
 <img
 src={content.imageUrl}
 alt=""
 className={imgClassName}
 onError={() => setImgFailed(true)}
 />
 );
}

/** Centered channel icon shown when a provided image fails to render. */
function ChannelIconFallback({ content, aspect }: { content: PreviewContent; aspect: string }) {
 return (
 <div
 className={`relative flex w-full ${aspect} items-center justify-center overflow-hidden bg-zinc-900`}
 >
 <BrandAvatar content={content} className="h-16 w-16 rounded-2xl" />
 </div>
 );
}

/**
 * Branded media area for media-first channels (Instagram, YouTube) when the
 * post has no image — those platforms always show visual media, so a text-only
 * layout would not reflect how the post actually looks.
 */
function BrandedMediaPlaceholder({ content, aspect }: { content: PreviewContent; aspect: string }) {
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
 <div
 className="absolute inset-0 opacity-30"
 style={{
 backgroundImage:
 "radial-gradient(circle at 30% 20%, rgba(255,255,255,.45), transparent 42%), radial-gradient(circle at 80% 70%, rgba(0,0,0,.25), transparent 40%)",
 }}
 />
 <div className="relative z-[1] flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white/90 shadow-lg">
 <BrandAvatar content={content} className="h-12 w-12 rounded-xl" />
 </div>
 <span className="relative z-[1] max-w-[80%] text-center text-[11px] font-medium text-white/90 drop-shadow">
 {content.brandName || "Your brand"}
 </span>
 </div>
 );
}

function MediaSlot({
 content,
 aspect,
 requireMedia = false,
}: {
 content: PreviewContent;
 aspect: string;
 /** Media-first platforms (Instagram, YouTube) always render a media area. */
 requireMedia?: boolean;
}) {
 const [imgFailed, setImgFailed] = useState(false);
 useEffect(() => setImgFailed(false), [content.imageUrl]);

 const resolvedAspect =
 content.mediaAspect === "4:5"
 ? "aspect-[4/5]"
 : content.mediaAspect === "16:9"
 ? "aspect-video"
 : content.mediaAspect === "1:1"
 ? "aspect-square"
 : aspect;
 if (content.mediaNode) {
 return (
 <div
 className={`relative flex w-full ${resolvedAspect} items-center justify-center overflow-hidden bg-black`}
 >
 {content.mediaNode}
 </div>
 );
 }
 if (content.videoUrl) {
 // Generated videos are always 9:16 — preview them vertically, not in the
 // platform's photo aspect, so the mobile preview matches the real output.
 // The CONTAINER owns the 9:16 shape (a bare <video> with w-auto can collapse
 // to 0 before metadata loads, showing nothing); the video just fills it.
 return (
 <div className="mx-auto flex aspect-[9/16] w-full max-w-[300px] items-center justify-center overflow-hidden bg-black">
 <video
 src={content.videoUrl}
 poster={content.imageUrl}
 className="h-full w-full object-cover"
 autoPlay
 muted
 loop
 playsInline
 controls={false}
 />
 </div>
 );
 }
 // Image provided but failed to load → show the channel icon instead of a broken image.
 if (content.imageUrl && imgFailed) {
 return <ChannelIconFallback content={content} aspect={resolvedAspect} />;
 }
 if (content.imageUrl) {
 return (
 <img
 src={content.imageUrl}
 alt=""
 className={`w-full ${resolvedAspect} object-cover`}
 onError={() => setImgFailed(true)}
 />
 );
 }
 // No media in the post. Media-first channels still show a branded media
 // area so the preview matches the real platform; text channels show nothing.
 if (requireMedia) {
 return <BrandedMediaPlaceholder content={content} aspect={resolvedAspect} />;
 }
 return null;
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
 <MediaSlot content={content} aspect="aspect-square" requireMedia />
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
 <InlineMedia
 content={content}
 imgClassName="mt-3 w-full rounded-xl border border-zinc-700 object-cover"
 fallbackClassName="mt-3 aspect-[16/9] w-full rounded-xl border border-zinc-700"
 />
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
 <MediaSlot content={content} aspect="aspect-video" requireMedia />
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

export function WhatsAppPreview({ content }: { content: PreviewContent }) {
 const body = [
 content.caption,
 content.hashtags?.length ? formatHashtags(content.hashtags) : "",
 ]
 .filter(Boolean)
 .join("\n\n");

 return (
 <div className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-[#0b141a] text-white shadow-2xl">
 <div className="flex items-center gap-2.5 bg-[#1f2c34] px-3 py-2.5">
 <BrandAvatar content={content} className="h-9 w-9 shrink-0 rounded-full" />
 <div className="min-w-0 flex-1">
 <div className="truncate text-[13px] font-semibold">
 {content.brandName ?? "Your Brand"}
 </div>
 <div className="text-[10px] text-[#8696a0]">Business account</div>
 </div>
 </div>
 <div
 className="space-y-2 px-3 py-4"
 style={{
 backgroundImage:
 "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.03) 0, transparent 40%), radial-gradient(circle at 80% 60%, rgba(255,255,255,0.025) 0, transparent 35%)",
 backgroundColor: "#0b141a",
 }}
 >
 <div className="ml-auto max-w-[88%] overflow-hidden rounded-xl rounded-tr-sm bg-[#005c4b] shadow-sm">
 <InlineMedia
 content={content}
 imgClassName="aspect-[4/3] w-full object-cover"
 fallbackClassName="aspect-[4/3] w-full"
 />
 <div className="space-y-1 px-2.5 py-2">
 <p className="whitespace-pre-line text-[13px] leading-snug text-white/95">
 {body || "Your message"}
 </p>
 <div className="text-right text-[10px] text-white/55">Just now</div>
 </div>
 </div>
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
 case "whatsapp":
 return <WhatsAppPreview content={content} />;
 default:
 return <LinkedInPreview content={content} />;
 }
}
