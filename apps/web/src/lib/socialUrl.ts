const DEFAULT_PLATFORM_URLS: Record<string, string> = {
  instagram: "https://www.instagram.com",
  linkedin: "https://www.linkedin.com/feed",
  youtube: "https://www.youtube.com",
  facebook: "https://www.facebook.com",
  twitter: "https://x.com",
  whatsapp: "https://web.whatsapp.com",
  reddit: "https://www.reddit.com",
};

export function getSocialPostUrl(post: {
  platforms?: string[];
  results?: Array<{ permalink?: string }>;
  openUrl?: string;
}): string {
  const permalink =
    post.openUrl ||
    post.results?.find((r) => typeof r.permalink === "string" && r.permalink.trim())?.permalink;
  if (permalink) return permalink;

  const primaryPlatform = post.platforms?.[0] ?? "instagram";
  return DEFAULT_PLATFORM_URLS[primaryPlatform] ?? "https://www.instagram.com";
}
