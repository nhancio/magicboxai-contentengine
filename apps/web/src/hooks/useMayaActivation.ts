import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuth } from "@shared/lib/auth";
import { getBrandProfiles } from "@shared/lib/automations";
import { isConvexConfigured } from "@/lib/convex";

/**
 * Convex owns Maya's activation state. During the Firestore migration, copy a
 * previously saved website kit across once so existing customers are not asked
 * to repeat onboarding.
 */
export function useMayaActivation() {
  const { user } = useAuth();
  const activation = useQuery(api.maya.activation, isConvexConfigured ? {} : "skip");
  const upsertFromWebsite = useMutation(api.brands.upsertFromWebsite);
  const attemptedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (
      !isConvexConfigured ||
      !user ||
      activation === undefined ||
      activation.hasWebsite ||
      attemptedForUser.current === user.uid
    ) {
      return;
    }

    attemptedForUser.current = user.uid;
    getBrandProfiles(user.uid)
      .then((profiles) => profiles.find((profile) => profile.websiteUrl?.trim()))
      .then((profile) => {
        if (!profile?.websiteUrl) return;
        return upsertFromWebsite({
          legacyId: profile.id,
          name: profile.name,
          websiteUrl: profile.websiteUrl,
          logoUrl: profile.logoUrl,
          colors: profile.colors,
          industry: profile.industry,
          toneOfVoice: profile.toneOfVoice,
          audience: profile.audience,
          hashtagSets: profile.hashtagSets,
          sampleCaptions: profile.sampleCaptions,
        });
      })
      .catch((error) => {
        console.warn("[maya] legacy website activation sync failed", error);
      });
  }, [activation, upsertFromWebsite, user]);

  return activation;
}
