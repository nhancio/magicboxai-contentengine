import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUid } from "./lib/auth";
import { geminiJson } from "./lib/gemini";

/** List the calling user's brand profiles (read-only prototype). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const uid = await requireUid(ctx);
    return await ctx.db
      .query("brandProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .collect();
  },
});

/**
 * Dual-write a website-derived brand kit during the Firebase → Convex migration.
 *
 * Maya reads its grounding data from Convex, so saving only the legacy
 * Firestore document would make a completed website step look missing here.
 */
export const upsertFromWebsite = mutation({
  args: {
    legacyId: v.string(),
    name: v.string(),
    websiteUrl: v.string(),
    logoUrl: v.optional(v.string()),
    colors: v.optional(
      v.object({
        primary: v.string(),
        secondary: v.optional(v.string()),
        accent: v.optional(v.string()),
      }),
    ),
    industry: v.optional(v.string()),
    toneOfVoice: v.optional(v.string()),
    audience: v.optional(v.string()),
    coreIdentity: v.optional(v.string()),
    productOffering: v.optional(v.string()),
    uniqueBenefits: v.optional(v.string()),
    problemSolution: v.optional(v.string()),
    mission: v.optional(v.string()),
    differentiation: v.optional(v.string()),
    ownedSpace: v.optional(v.string()),
    contentAngles: v.optional(v.array(v.string())),
    toneDos: v.optional(v.array(v.string())),
    toneDonts: v.optional(v.array(v.string())),
    customerSegments: v.optional(
      v.array(
        v.object({
          segmentName: v.string(),
          percentage: v.number(),
        })
      )
    ),
    competitors: v.optional(v.array(v.string())),
    hashtagSets: v.optional(v.object({ default: v.array(v.string()) })),
    sampleCaptions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const uid = await requireUid(ctx);
    const url = new URL(args.websiteUrl);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname) {
      throw new Error("Website must be a valid http or https URL");
    }
    if (!args.legacyId.trim() || !args.name.trim()) {
      throw new Error("Brand id and name are required");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("brandProfiles")
      .withIndex("by_legacyId", (q) => q.eq("legacyId", args.legacyId))
      .unique();

    const values = {
      name: args.name.trim().slice(0, 160),
      websiteUrl: url.toString(),
      ...(args.logoUrl ? { logoUrl: args.logoUrl } : {}),
      ...(args.colors ? { colors: args.colors } : {}),
      ...(args.industry ? { industry: args.industry } : {}),
      ...(args.toneOfVoice ? { toneOfVoice: args.toneOfVoice } : {}),
      ...(args.audience ? { audience: args.audience } : {}),
      ...(args.coreIdentity ? { coreIdentity: args.coreIdentity } : {}),
      ...(args.productOffering ? { productOffering: args.productOffering } : {}),
      ...(args.uniqueBenefits ? { uniqueBenefits: args.uniqueBenefits } : {}),
      ...(args.problemSolution ? { problemSolution: args.problemSolution } : {}),
      ...(args.mission ? { mission: args.mission } : {}),
      ...(args.differentiation ? { differentiation: args.differentiation } : {}),
      ...(args.ownedSpace ? { ownedSpace: args.ownedSpace } : {}),
      ...(args.contentAngles ? { contentAngles: args.contentAngles } : {}),
      ...(args.toneDos ? { toneDos: args.toneDos } : {}),
      ...(args.toneDonts ? { toneDonts: args.toneDonts } : {}),
      ...(args.customerSegments ? { customerSegments: args.customerSegments } : {}),
      ...(args.competitors ? { competitors: args.competitors } : {}),
      ...(args.hashtagSets ? { hashtagSets: args.hashtagSets } : {}),
      ...(args.sampleCaptions ? { sampleCaptions: args.sampleCaptions } : {}),
      updatedAt: now,
    };

    let brandProfileId;
    if (existing) {
      if (existing.userId !== uid) throw new Error("Brand profile not found");
      await ctx.db.patch(existing._id, values);
      brandProfileId = existing._id;
    } else {
      brandProfileId = await ctx.db.insert("brandProfiles", {
        legacyId: args.legacyId,
        userId: uid,
        ...values,
        createdAt: now,
      });
    }

    const config = await ctx.db
      .query("mayaConfig")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .unique();
    if (config && !config.brandProfileId) {
      await ctx.db.patch(config._id, { brandProfileId, updatedAt: now });
    }

    return { brandProfileId };
  },
});

/** Remove the Convex mirror when a legacy website kit is deleted. */
export const removeByLegacyId = mutation({
  args: { legacyId: v.string() },
  handler: async (ctx, { legacyId }) => {
    const uid = await requireUid(ctx);
    const existing = await ctx.db
      .query("brandProfiles")
      .withIndex("by_legacyId", (q) => q.eq("legacyId", legacyId))
      .unique();
    if (!existing || existing.userId !== uid) return { removed: false };

    const alternatives = await ctx.db
      .query("brandProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .collect();
    const replacement = alternatives.find(
      (brand) => brand._id !== existing._id && brand.websiteUrl?.trim(),
    );
    const config = await ctx.db
      .query("mayaConfig")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .unique();

    await ctx.db.delete(existing._id);
    if (config?.brandProfileId === existing._id) {
      await ctx.db.patch(config._id, {
        brandProfileId: replacement?._id,
        enabled: !!replacement,
        updatedAt: Date.now(),
      });
    }
    return { removed: true };
  },
});

/** Update specific details of a brand kit from the UI. */
export const updateDetails = mutation({
  args: {
    legacyId: v.string(),
    coreIdentity: v.optional(v.string()),
    productOffering: v.optional(v.string()),
    uniqueBenefits: v.optional(v.string()),
    problemSolution: v.optional(v.string()),
    mission: v.optional(v.string()),
    differentiation: v.optional(v.string()),
    ownedSpace: v.optional(v.string()),
    contentAngles: v.optional(v.array(v.string())),
    toneDos: v.optional(v.array(v.string())),
    toneDonts: v.optional(v.array(v.string())),
    customerSegments: v.optional(
      v.array(
        v.object({
          segmentName: v.string(),
          percentage: v.number(),
        })
      )
    ),
    competitors: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const uid = await requireUid(ctx);
    const existing = await ctx.db
      .query("brandProfiles")
      .withIndex("by_legacyId", (q) => q.eq("legacyId", args.legacyId))
      .unique();
      
    if (!existing || existing.userId !== uid) {
      throw new Error("Brand profile not found");
    }

    const { legacyId, ...updates } = args;
    await ctx.db.patch(existing._id, {
      ...updates,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/** Extract a full brand kit from a website URL using native fetch & Gemini JSON. */
export const extractFromWebsite = action({
  args: { url: v.string() },
  returns: v.object({
    companyName: v.string(),
    industry: v.string(),
    audience: v.string(),
    tone: v.string(),
    hashtags: v.array(v.string()),
    sampleCaptions: v.array(v.string()),
    logoUrl: v.string(),
    websiteImages: v.array(
      v.object({
        url: v.string(),
        alt: v.string(),
        kind: v.union(
          v.literal("product"),
          v.literal("hero"),
          v.literal("social"),
          v.literal("content")
        ),
      })
    ),
    brandedImageUrl: v.string(),
    brandedImageSource: v.union(
      v.literal("website"),
      v.literal("generated"),
      v.literal("")
    ),
    colors: v.object({
      primary: v.optional(v.string()),
      secondary: v.optional(v.string()),
      accent: v.optional(v.string()),
    }),
    fonts: v.array(v.string()),
    coreIdentity: v.optional(v.string()),
    productOffering: v.optional(v.string()),
    uniqueBenefits: v.optional(v.string()),
    problemSolution: v.optional(v.string()),
    mission: v.optional(v.string()),
    differentiation: v.optional(v.string()),
    ownedSpace: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    await requireUid(ctx);
    let target = args.url.trim();
    if (!target) throw new Error("Enter a website URL.");
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`;

    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      throw new Error("Invalid website URL");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    let html = "";
    try {
      const res = await fetch(parsed.toString(), {
        signal: controller.signal,
        headers: { "User-Agent": "MagicBoxBot/1.0 (+https://magicboxai.in)" },
      });
      if (res.ok) {
        html = await res.text();
      }
    } catch (e) {
      console.warn("[Convex:brands] Failed to fetch html directly:", e);
    } finally {
      clearTimeout(timer);
    }

    let title = "";
    let description = "";
    let logoUrl = "";
    let primaryColor = "#0f172a";
    let secondaryColor = "#6366f1";
    let accentColor = "#38bdf8";

    if (html) {
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      title = (titleMatch ? titleMatch[1] : "").replace(/\s+/g, " ").trim();

      const descMatch =
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
        html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);
      description = (descMatch ? descMatch[1] : "").trim();

      // Look for logo / icon
      const iconMatch =
        html.match(/<link[^>]+rel=["'](?:apple-touch-icon|icon|shortcut icon)["'][^>]+href=["']([^"']*)["']/i) ||
        html.match(/<link[^>]+href=["']([^"']*)["'][^>]+rel=["'](?:apple-touch-icon|icon|shortcut icon)["']/i);
      if (iconMatch && iconMatch[1]) {
        try {
          logoUrl = new URL(iconMatch[1], parsed).toString();
        } catch {
          // ignore
        }
      }

      if (!logoUrl) {
        const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i);
        if (ogImage && ogImage[1]) {
          try {
            logoUrl = new URL(ogImage[1], parsed).toString();
          } catch {
            // ignore
          }
        }
      }

      const themeColor = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']*)["']/i);
      if (themeColor && /^#[0-9a-f]{6}$/i.test(themeColor[1])) {
        primaryColor = themeColor[1];
      }
    }

    if (!logoUrl) {
      logoUrl = `${parsed.origin}/favicon.ico`;
    }

    const host = parsed.hostname.replace(/^www\./, "");
    const defaultCompanyName = title
      ? title.split(/[-–—|•:]/)[0].trim()
      : host.split(".")[0].charAt(0).toUpperCase() + host.split(".")[0].slice(1);

    const prompt = `Website URL: ${parsed.toString()}
Website Title: ${title}
Website Description: ${description}
Page Content Extract:
${html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 5000)}`;

    const schema = {
      type: "object",
      properties: {
        companyName: { type: "string" },
        industry: { type: "string" },
        audience: { type: "string" },
        tone: { type: "string" },
        coreIdentity: { type: "string" },
        productOffering: { type: "string" },
        uniqueBenefits: { type: "string" },
        problemSolution: { type: "string" },
        mission: { type: "string" },
        differentiation: { type: "string" },
        ownedSpace: { type: "string" },
        hashtags: { type: "array", items: { type: "string" } },
        sampleCaptions: { type: "array", items: { type: "string" } },
        primaryColor: { type: "string" },
        secondaryColor: { type: "string" },
        accentColor: { type: "string" },
      },
      required: ["companyName", "industry", "audience", "tone", "hashtags", "sampleCaptions"],
    };

    let aiProfile: any = null;
    try {
      aiProfile = await geminiJson({
        prompt,
        schema,
        system: "You are a senior brand strategist. Extract the brand name, industry, target audience, brand tone of voice (3-5 keywords), 5 relevant hashtag words, 2 short engaging sample social post captions, and recommended brand hex colors (#hex) from the website content. No markdown, JSON only.",
      });
    } catch (e) {
      console.warn("[Convex:brands] geminiJson failed, using fallback:", e);
    }

    const companyName = aiProfile?.companyName?.trim() || defaultCompanyName || "Your Brand";
    const industry = aiProfile?.industry?.trim() || "Technology & Services";
    const audience = aiProfile?.audience?.trim() || "Modern consumers and growing businesses";
    const tone = aiProfile?.tone?.trim() || "Professional, innovative, and approachable";
    const hashtags = Array.isArray(aiProfile?.hashtags) && aiProfile.hashtags.length > 0
      ? aiProfile.hashtags.map((h: string) => String(h).replace(/^#/, "").trim()).filter(Boolean)
      : [companyName.toLowerCase().replace(/\s+/g, ""), "business", "innovation", "growth"];
    const sampleCaptions = Array.isArray(aiProfile?.sampleCaptions) && aiProfile.sampleCaptions.length > 0
      ? aiProfile.sampleCaptions.map((c: string) => String(c).trim()).filter(Boolean)
      : [
          `Discover how ${companyName} delivers quality and innovation for our clients.`,
          `Consistency and excellence — here is what we are building at ${companyName}.`,
        ];

    const colors = {
      primary: (aiProfile?.primaryColor && /^#[0-9a-f]{6}$/i.test(aiProfile.primaryColor)) ? aiProfile.primaryColor : primaryColor,
      secondary: (aiProfile?.secondaryColor && /^#[0-9a-f]{6}$/i.test(aiProfile.secondaryColor)) ? aiProfile.secondaryColor : secondaryColor,
      accent: (aiProfile?.accentColor && /^#[0-9a-f]{6}$/i.test(aiProfile.accentColor)) ? aiProfile.accentColor : accentColor,
    };

    return {
      companyName,
      industry,
      audience,
      tone,
      hashtags,
      sampleCaptions,
      logoUrl,
      websiteImages: [],
      brandedImageUrl: "",
      brandedImageSource: "" as const,
      colors,
      fonts: ["Inter", "sans-serif"],
      coreIdentity: aiProfile?.coreIdentity || undefined,
      productOffering: aiProfile?.productOffering || undefined,
      uniqueBenefits: aiProfile?.uniqueBenefits || undefined,
      problemSolution: aiProfile?.problemSolution || undefined,
      mission: aiProfile?.mission || undefined,
      differentiation: aiProfile?.differentiation || undefined,
      ownedSpace: aiProfile?.ownedSpace || undefined,
    };
  },
});


