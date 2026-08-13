import { mutation } from "./_generated/server";

export const dummyListings = mutation({
  handler: async (ctx) => {
    const dummyUserId = "dummy-user-123";
    const now = Date.now();

    const listings = [
      {
        userId: dummyUserId,
        platform: "instagram" as const,
        title: "Instagram 15K Crypto/Finance Account",
        handleOrUrl: "@crypto_daily_15k",
        followerCount: 15000,
        followerCountLabel: "15K",
        avgViews: 8000,
        avgLikes: 1200,
        engagementRate: "8%",
        accountAgeMonths: 24,
        niche: "Business & Finance",
        askingPrice: 10,
        contactEmail: "seller1@example.com",
        transferNotes: "PVA, never shadowbanned, original email included.",
        status: "verified" as const,
        createdAt: now,
        updatedAt: now,
      },
      {
        userId: dummyUserId,
        platform: "youtube" as const,
        title: "YouTube 20K Tech Shorts Channel",
        handleOrUrl: "https://youtube.com/@tech_shorts_20k",
        followerCount: 20000,
        followerCountLabel: "20K",
        avgViews: 45000,
        avgLikes: 3000,
        engagementRate: "12%",
        accountAgeMonths: 18,
        niche: "Tech & SaaS",
        askingPrice: 10,
        contactEmail: "seller2@example.com",
        transferNotes: "Monetized, no strikes, clean history.",
        status: "verified" as const,
        createdAt: now - 86400000, // 1 day ago
        updatedAt: now - 86400000,
      },
      {
        userId: dummyUserId,
        platform: "instagram" as const,
        title: "Instagram 8K Fitness Motivation",
        handleOrUrl: "@fit_motivate_8k",
        followerCount: 8000,
        followerCountLabel: "8K",
        avgViews: 3500,
        avgLikes: 600,
        engagementRate: "7.5%",
        accountAgeMonths: 12,
        niche: "Fitness & Wellness",
        askingPrice: 10,
        contactEmail: "seller3@example.com",
        transferNotes: "Great engagement on reels, original content.",
        status: "verified" as const,
        createdAt: now - 172800000, // 2 days ago
        updatedAt: now - 172800000,
      },
    ];

    for (const listing of listings) {
      await ctx.db.insert("warmedAccountListings", listing);
    }

    return "Successfully seeded 3 dummy listings!";
  },
});
