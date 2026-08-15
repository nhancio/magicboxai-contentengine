import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const inspectUser = query({
  args: {
    uid: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  returns: v.object({
    counts: v.record(v.string(), v.number()),
    total: v.number(),
  }),
  handler: async (ctx, args) => {
    const uid = args.uid;
    const email = args.email?.toLowerCase();
    const counts: Record<string, number> = {};

    // 1. users
    const users = await ctx.db.query("users").collect();
    counts.users = users.filter(
      (u) => (uid && u.legacyId === uid) || (email && u.email.toLowerCase() === email)
    ).length;

    // 2. subscriptions
    const subs = await ctx.db.query("subscriptions").collect();
    counts.subscriptions = subs.filter(
      (s) => (uid && (s.userId === uid || s.legacyId === uid))
    ).length;

    // 3. brandProfiles
    const brands = await ctx.db.query("brandProfiles").collect();
    counts.brandProfiles = brands.filter((b) => uid && b.userId === uid).length;

    // 4. socialAccounts
    const socialAccounts = await ctx.db.query("socialAccounts").collect();
    counts.socialAccounts = socialAccounts.filter((s) => uid && s.userId === uid).length;

    // 5. socialTokens
    const socialTokens = await ctx.db.query("socialTokens").collect();
    counts.socialTokens = socialTokens.filter((s) => uid && s.userId === uid).length;

    // 6. automations
    const automations = await ctx.db.query("automations").collect();
    counts.automations = automations.filter((a) => uid && a.userId === uid).length;

    // 7. posts
    const posts = await ctx.db.query("posts").collect();
    counts.posts = posts.filter((p) => uid && p.userId === uid).length;

    // 8. paymentEvents
    const paymentEvents = await ctx.db.query("paymentEvents").collect();
    counts.paymentEvents = paymentEvents.filter((p) => uid && p.userId === uid).length;

    // 9. videoJobs
    const videoJobs = await ctx.db.query("videoJobs").collect();
    counts.videoJobs = videoJobs.filter((v) => uid && v.userId === uid).length;

    // 10. avatars
    const avatars = await ctx.db.query("avatars").collect();
    counts.avatars = avatars.filter((a) => uid && a.userId === uid).length;

    // 11. studioVideos
    const studioVideos = await ctx.db.query("studioVideos").collect();
    counts.studioVideos = studioVideos.filter((s) => uid && s.userId === uid).length;

    // 12. myVideos
    const myVideos = await ctx.db.query("myVideos").collect();
    counts.myVideos = myVideos.filter((m) => uid && m.userId === uid).length;

    // 13. oauthStates
    const oauthStates = await ctx.db.query("oauthStates").collect();
    counts.oauthStates = oauthStates.filter((o) => uid && o.userId === uid).length;

    // 14. suggestions
    const suggestions = await ctx.db.query("suggestions").collect();
    counts.suggestions = suggestions.filter((s) => uid && s.userId === uid).length;

    // 15. slotTemplates
    const slotTemplates = await ctx.db.query("slotTemplates").collect();
    counts.slotTemplates = slotTemplates.filter((s) => uid && s.userId === uid).length;

    // 16. contentPillars
    const contentPillars = await ctx.db.query("contentPillars").collect();
    counts.contentPillars = contentPillars.filter((c) => uid && c.userId === uid).length;

    // 17. mayaConfig
    const mayaConfig = await ctx.db.query("mayaConfig").collect();
    counts.mayaConfig = mayaConfig.filter((m) => uid && m.userId === uid).length;

    // 18. mediaJobs
    const mediaJobs = await ctx.db.query("mediaJobs").collect();
    counts.mediaJobs = mediaJobs.filter((m) => uid && m.userId === uid).length;

    // 19. creditBalances
    const creditBalances = await ctx.db.query("creditBalances").collect();
    counts.creditBalances = creditBalances.filter((c) => uid && c.userId === uid).length;

    // 20. creditLedger
    const creditLedger = await ctx.db.query("creditLedger").collect();
    counts.creditLedger = creditLedger.filter((c) => uid && c.userId === uid).length;

    // 21. apiLogs
    const apiLogs = await ctx.db.query("apiLogs").collect();
    counts.apiLogs = apiLogs.filter((a) => uid && a.userId === uid).length;

    // 22. warmedAccountListings
    const listings = await ctx.db.query("warmedAccountListings").collect();
    counts.warmedAccountListings = listings.filter(
      (l) => (uid && l.userId === uid) || (email && l.contactEmail.toLowerCase() === email)
    ).length;

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return { counts, total };
  },
});

export const purgeUser = mutation({
  args: {
    uid: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  returns: v.object({
    deletedCounts: v.record(v.string(), v.number()),
    total: v.number(),
  }),
  handler: async (ctx, args) => {
    const uid = args.uid;
    const email = args.email?.toLowerCase();
    const deletedCounts: Record<string, number> = {};

    // 1. users
    const users = await ctx.db.query("users").collect();
    const matchedUsers = users.filter(
      (u) => (uid && u.legacyId === uid) || (email && u.email.toLowerCase() === email)
    );
    for (const u of matchedUsers) await ctx.db.delete(u._id);
    deletedCounts.users = matchedUsers.length;

    // 2. subscriptions
    const subs = await ctx.db.query("subscriptions").collect();
    const matchedSubs = subs.filter(
      (s) => (uid && (s.userId === uid || s.legacyId === uid))
    );
    for (const s of matchedSubs) await ctx.db.delete(s._id);
    deletedCounts.subscriptions = matchedSubs.length;

    // 3. brandProfiles
    const brands = await ctx.db.query("brandProfiles").collect();
    const matchedBrands = brands.filter((b) => uid && b.userId === uid);
    for (const b of matchedBrands) await ctx.db.delete(b._id);
    deletedCounts.brandProfiles = matchedBrands.length;

    // 4. socialAccounts
    const socialAccounts = await ctx.db.query("socialAccounts").collect();
    const matchedSocial = socialAccounts.filter((s) => uid && s.userId === uid);
    for (const s of matchedSocial) await ctx.db.delete(s._id);
    deletedCounts.socialAccounts = matchedSocial.length;

    // 5. socialTokens
    const socialTokens = await ctx.db.query("socialTokens").collect();
    const matchedTokens = socialTokens.filter((s) => uid && s.userId === uid);
    for (const s of matchedTokens) await ctx.db.delete(s._id);
    deletedCounts.socialTokens = matchedTokens.length;

    // 6. automations
    const automations = await ctx.db.query("automations").collect();
    const matchedAutomations = automations.filter((a) => uid && a.userId === uid);
    for (const a of matchedAutomations) await ctx.db.delete(a._id);
    deletedCounts.automations = matchedAutomations.length;

    // 7. posts
    const posts = await ctx.db.query("posts").collect();
    const matchedPosts = posts.filter((p) => uid && p.userId === uid);
    for (const p of matchedPosts) await ctx.db.delete(p._id);
    deletedCounts.posts = matchedPosts.length;

    // 8. paymentEvents
    const paymentEvents = await ctx.db.query("paymentEvents").collect();
    const matchedPaymentEvents = paymentEvents.filter((p) => uid && p.userId === uid);
    for (const p of matchedPaymentEvents) await ctx.db.delete(p._id);
    deletedCounts.paymentEvents = matchedPaymentEvents.length;

    // 9. videoJobs
    const videoJobs = await ctx.db.query("videoJobs").collect();
    const matchedVideoJobs = videoJobs.filter((v) => uid && v.userId === uid);
    for (const v of matchedVideoJobs) await ctx.db.delete(v._id);
    deletedCounts.videoJobs = matchedVideoJobs.length;

    // 10. avatars
    const avatars = await ctx.db.query("avatars").collect();
    const matchedAvatars = avatars.filter((a) => uid && a.userId === uid);
    for (const a of matchedAvatars) await ctx.db.delete(a._id);
    deletedCounts.avatars = matchedAvatars.length;

    // 11. studioVideos
    const studioVideos = await ctx.db.query("studioVideos").collect();
    const matchedStudioVideos = studioVideos.filter((s) => uid && s.userId === uid);
    for (const s of matchedStudioVideos) await ctx.db.delete(s._id);
    deletedCounts.studioVideos = matchedStudioVideos.length;

    // 12. myVideos
    const myVideos = await ctx.db.query("myVideos").collect();
    const matchedMyVideos = myVideos.filter((m) => uid && m.userId === uid);
    for (const m of matchedMyVideos) {
      if (m.rawStorageId) {
        try {
          await ctx.storage.delete(m.rawStorageId);
        } catch (_) {}
      }
      if (m.editedStorageId) {
        try {
          await ctx.storage.delete(m.editedStorageId);
        } catch (_) {}
      }
      await ctx.db.delete(m._id);
    }
    deletedCounts.myVideos = matchedMyVideos.length;

    // 13. oauthStates
    const oauthStates = await ctx.db.query("oauthStates").collect();
    const matchedOauthStates = oauthStates.filter((o) => uid && o.userId === uid);
    for (const o of matchedOauthStates) await ctx.db.delete(o._id);
    deletedCounts.oauthStates = matchedOauthStates.length;

    // 14. suggestions
    const suggestions = await ctx.db.query("suggestions").collect();
    const matchedSuggestions = suggestions.filter((s) => uid && s.userId === uid);
    for (const s of matchedSuggestions) await ctx.db.delete(s._id);
    deletedCounts.suggestions = matchedSuggestions.length;

    // 15. slotTemplates
    const slotTemplates = await ctx.db.query("slotTemplates").collect();
    const matchedSlots = slotTemplates.filter((s) => uid && s.userId === uid);
    for (const s of matchedSlots) await ctx.db.delete(s._id);
    deletedCounts.slotTemplates = matchedSlots.length;

    // 16. contentPillars
    const contentPillars = await ctx.db.query("contentPillars").collect();
    const matchedPillars = contentPillars.filter((c) => uid && c.userId === uid);
    for (const c of matchedPillars) await ctx.db.delete(c._id);
    deletedCounts.contentPillars = matchedPillars.length;

    // 17. mayaConfig
    const mayaConfig = await ctx.db.query("mayaConfig").collect();
    const matchedMaya = mayaConfig.filter((m) => uid && m.userId === uid);
    for (const m of matchedMaya) await ctx.db.delete(m._id);
    deletedCounts.mayaConfig = matchedMaya.length;

    // 18. mediaJobs
    const mediaJobs = await ctx.db.query("mediaJobs").collect();
    const matchedMediaJobs = mediaJobs.filter((m) => uid && m.userId === uid);
    for (const m of matchedMediaJobs) {
      if (m.storageId) {
        try {
          await ctx.storage.delete(m.storageId);
        } catch (_) {}
      }
      await ctx.db.delete(m._id);
    }
    deletedCounts.mediaJobs = matchedMediaJobs.length;

    // 19. creditBalances
    const creditBalances = await ctx.db.query("creditBalances").collect();
    const matchedBalances = creditBalances.filter((c) => uid && c.userId === uid);
    for (const c of matchedBalances) await ctx.db.delete(c._id);
    deletedCounts.creditBalances = matchedBalances.length;

    // 20. creditLedger
    const creditLedger = await ctx.db.query("creditLedger").collect();
    const matchedLedger = creditLedger.filter((c) => uid && c.userId === uid);
    for (const c of matchedLedger) await ctx.db.delete(c._id);
    deletedCounts.creditLedger = matchedLedger.length;

    // 21. apiLogs
    const apiLogs = await ctx.db.query("apiLogs").collect();
    const matchedLogs = apiLogs.filter((a) => uid && a.userId === uid);
    for (const a of matchedLogs) await ctx.db.delete(a._id);
    deletedCounts.apiLogs = matchedLogs.length;

    // 22. warmedAccountListings
    const listings = await ctx.db.query("warmedAccountListings").collect();
    const matchedListings = listings.filter(
      (l) => (uid && l.userId === uid) || (email && l.contactEmail.toLowerCase() === email)
    );
    for (const l of matchedListings) await ctx.db.delete(l._id);
    deletedCounts.warmedAccountListings = matchedListings.length;

    const total = Object.values(deletedCounts).reduce((a, b) => a + b, 0);
    return { deletedCounts, total };
  },
});
