# Trend-ranked creator templates

Research snapshot: 2026-08-01

## Product behavior

MagicBox keeps durable production templates in
`packages/backend/convex/lib/presets.ts` and ranks them against the short-lived
rows refreshed by `packages/backend/convex/trends.ts`.

This avoids two bad extremes:

- asking a customer to write a production prompt from scratch;
- hard-coding a meme or audio after its useful life has ended.

Studio requests the ranked catalogue for the selected platform. A user can
choose a card and click Create without writing a prompt. The chosen template
already contains a starter brief, hook/beat structure, shot direction, platform
support, trend-match phrases, and any rights warning.

Maya ranks the same catalogue for every daily deck. Each suggestion selects one
compatible `templateId`, combines it with the brand, current trend evidence,
and hook tournament, then persists the selection in `creativePlan`.

## Initial current formats

- **Miniature Crew:** tiny original workers complete a real brand process around
  an oversized product in one macro, left-to-right tracking shot.
- **Comic Duo Banter:** short buddy-comedy setup, clever fix, and reaction-loop
  payoff. It can reproduce the broad Motu Patlu comic rhythm, but uses original
  characters unless the customer supplies licensed assets.
- **Work Chaos Punchline:** a painfully specific workplace mistake followed by
  a hard-cut useful fix.
- **Living Moodboard:** five connected brand details, gentle match cuts, and a
  final frame that loops into the first.

The remaining evergreen formats—talking head, problem/solution, product demo,
listicle, GRWM, unboxing, before/after, storytime, POV, comparison, and others—
stay available when no live trend is a genuine fit.

## Evidence used for this snapshot

- Meta reports that comedy is one of India's most-engaged Reels genres and that
  creator-led Reels are a major discovery and commerce surface:
  https://about.fb.com/news/2026/06/reels-is-shaping-indias-video-first-future-across-gen-z-women-bharat/
- Later's weekly July 2026 roundup includes relatable work-chaos humor and
  moving moodboard-style sequences:
  https://later.com/blog/instagram-reels-trends/
- SocialBee's July 2026 tracker specifically describes the tiny-workers format
  and the workplace AI-replacement joke structure:
  https://socialbee.com/blog/instagram-trends/
- Meta says Instagram recommendations increasingly favor original posts, which
  supports adapting structural grammar rather than copying a creator, character,
  or branded sequence:
  https://about.fb.com/news/2026/01/2026-ai-drives-performance/

Third-party trackers are directional evidence, not an Instagram-wide chart.
MagicBox only marks a template `isTrending` when a current evidence row matches
its declared signals.

## Adding or updating a template

Add one entry to the canonical `PRESETS` array with:

1. a stable id and plain-language name;
2. a one-click `starterPrompt`;
3. relevant `trendSignals` rather than a date-dependent claim;
4. observable structure and production direction;
5. supported platforms and media type;
6. a rights note when a recognizable character, audio, creator, or franchise
   could be involved.

Do not add exact copyrighted dialogue, signature character designs, creator
likenesses, or licensed music. Trend evidence changes daily; durable production
grammar changes only through reviewed code updates.
