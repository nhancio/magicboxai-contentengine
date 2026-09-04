/**
 * MAYA template + adaptation types.
 *
 * The canonical definitions live in the Convex backend (that's what the
 * deployed pipeline compiles against). This module re-exports them so the
 * MAYA-Templates package stays a single source of truth rather than a second
 * copy that silently drifts out of sync.
 */
export type {
  MemeFormat,
  AspectRatio,
  TemplateBeat,
  TextOverlaySlot,
  AudioSlot,
  LipSyncSlot,
  MemeTemplate,
  BrandContext,
  BrandAdaptationRequest,
  AdaptedLipSyncLine,
  AdaptedTextOverlay,
  AdaptedSubtitleCue,
  AdaptedSfxCue,
  SynthesizedAdaptation,
} from "../../packages/backend/convex/lib/maya/types";
