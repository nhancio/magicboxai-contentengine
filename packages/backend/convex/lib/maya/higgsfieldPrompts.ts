/**
 * House reference prompts for the replication pipeline (step 3).
 *
 * These are the few-shot examples fed to the model so the generated prompt
 * matches the house structure: a long-form sectioned production document, not
 * a paragraph of comma-separated tags.
 *
 * The two examples below are the user's own reference prompts, kept VERBATIM.
 * Two things in them do real work and must survive into every generated
 * prompt:
 *   1. ACTIVE REFERENCES splits the inputs — the IMAGE is the brand's product
 *      (dimensionally stable source of truth), the VIDEO controls *only*
 *      energy/pacing.
 *   2. The explicit "create an original concept: do not reproduce its
 *      characters, locations, compositions or individual shots" lock. This is
 *      what keeps output inspired-by rather than a clone of someone's reel.
 */

/** The section skeleton every generated prompt must follow. Always sent, even when examples are trimmed. */
export const HOUSE_PROMPT_STRUCTURE = `SCENE CONTEXT
  Genre, duration, energy source. Must include an explicit instruction to
  create an ORIGINAL concept and not reproduce the reference's characters,
  locations, compositions or individual shots.

ACTIVE REFERENCES
  <<<image_1>>> — the brand's product/logo. Absolute source of truth.
  Preserve its exact colours, proportions, typography and layout. It must stay
  recognisable and dimensionally stable in every shot.
  @Video1 — the reference reel. Controls ONLY the overall energy: pacing,
  cutting rhythm, performance intensity, lighting attitude, transition style.

FORMAT MODE
  Shot structure and the cut vocabulary used (HARD CUT / MATCH CUT / WHIP CUT /
  INSERT CUT).

FIRST FRAME AND SPATIAL BLOCKING
  What is already on screen at t=0. Never an empty establishing frame.

ACTION TIMING
  BEAT 1..N, each separated by an explicit cut marker. Each beat is one clear
  action that reads on its own.

OPTICS
  Field of view in degrees plus camera distance per shot type. Locked within
  each shot.

CAMERA
  Movement character — what kind of operator/rig this feels like.

PHYSICS
  Mass, contact, material behaviour, cause-and-effect.

LIGHTING
  Setup, palette, and how the product highlight is controlled.

AUDIO
  Music style, SFX, and scripted lines only. No unscripted dialogue.

POSITIVE LOCKS
  Product fidelity requirements and what the final frame must show.`;

export interface HouseReferencePrompt {
  /** What genre of reel this example covers — used to pick the closest match. */
  genre:
    | "talking_animal"
    | "animated_object"
    | "3d_mascot"
    | "superhero_parody"
    | "desi_domestic"
    | "product_reveal";
  /** The dominant camera language of the example. */
  cameraMotion: string;
  prompt: string;
}

const CRUNCHO_EXAMPLE = `SCENE CONTEXT

A 30-second high-energy commercial for CRUNCHO sour cream & onion chips, inspired by the rapid pacing, playful absurdism, practical miniatures, retro Japanese television energy and mixed-media transitions of @Video1. Create an original concept: do not reproduce its characters, locations, monsters, compositions or individual shots.

ACTIVE REFERENCES

<<<image_1>>> is the absolute source of truth for the product. Preserve the exact dark emerald-green glossy pillow bag, inflated proportions, lime-green stacked "CRU / CRUNCHO / CHO" typography, pink "New!" starburst and the cream "Sour cream & onion • 150g" line. The package must remain recognizable and dimensionally stable in every shot.

@Video1 controls only the overall energy: fast pattern interrupts, theatrical acting, hard studio lighting, miniature practical sets, retro broadcast texture, crash zooms, exaggerated sound effects and transitions between live action, handmade miniatures and original 2D animation.

FORMAT MODE

Controlled multi-shot commercial with fast HARD CUTS and one MATCH CUT. Each shot lasts long enough for its main action to read clearly. The escalation moves from quiet live action to controlled visual chaos, then resolves into a clean premium product hero shot.

FIRST FRAME AND SPATIAL BLOCKING

The first visible frame already contains the CRUNCHO package, centered and floating 20 centimeters above a cream-colored pedestal. The front label faces the camera perfectly. A miniature retro Japanese convenience store fills the background. No empty establishing frame.

ACTION TIMING

BEAT 1 — A dead-serious office worker stands behind the miniature convenience-store counter while everyone around her is frozen in boredom. The floating CRUNCHO package slowly rotates toward camera. An energetic announcer suddenly shouts: "退屈な午後に、ザクッと革命！" A sharp crash zoom lands on the pink "New!" starburst.

HARD CUT

BEAT 2 — The vending machine spits the package directly into the worker's hands with comically precise mechanical force. She catches it against her chest, shocked. The glossy bag compresses naturally, then regains its inflated shape.

INSERT CUT

BEAT 3 — Extreme macro product detail: fingers tear open the top seam. The plastic stretches, wrinkles and opens with a crisp foil snap. A single golden potato crisp rises from the bag in dramatic slow motion, surrounded by tiny cream-colored clouds and bright green onion rings made from practical paper props.

MATCH CUT

BEAT 4 — The circular onion ring becomes a bold original 2D animated portal. The worker appears as a hand-drawn retro commercial heroine with exaggerated speed lines. She bites the crisp. A huge graphic lime-green crunch wave explodes outward as abstract kinetic Japanese-style glyph shapes, energetic but not readable brand text.

HARD CUT

BEAT 5 — Return to live action. The crunch wave travels through the miniature city without destroying it. A toy train snaps into rhythm, umbrellas open in perfect sync, traffic lights pulse lime green, paper buildings bounce gently and frozen commuters begin a strange synchronized dance. Physical miniature materials remain visible: cardboard edges, painted wood and practical wires.

HARD CUT

BEAT 6 — Rapid comedic montage: a tiny sour-cream cloud conducts an orchestra with a green-onion baton; three office workers perform one perfectly synchronized shoulder move; a serious businessman hears the crunch and his tie shoots straight upward; the heroine looks directly into camera with exaggerated triumph.

HARD CUT

BEAT 7 — Premium macro sequence: golden crisps tumble with believable gravity around the CRUNCHO package; cream swirls and fresh green onion rings move through the background as stylized ingredients without covering the label. Moving highlights travel across the glossy emerald plastic.

HARD CUT

BEAT 8 — Final hero frame on a warm cream background. The CRUNCHO package lands upright on the pedestal with a soft weighted bounce. A few crisps settle around its base. The front label is fully visible and matches <<<image_1>>> exactly. The announcer delivers the final line with joyful intensity: "クリーミー、オニオン、ザクッとクランチ！ CRUNCHO！" End on the package for a long, clean product hold.

OPTICS

Use a 47° standard-normal field of view for live-action medium shots, camera 3 to 4 meters from the actors, with natural proportions and readable miniature depth. Use an 84° classic wide field of view for energetic convenience-store shots, camera physically close to the foreground action with strong perspective expansion and straight rectilinear lines. Use an 18° telephoto character for package and crisp macro inserts, with razor-sharp product detail and creamy background separation. Lock the optics within each shot.

CAMERA

Mix theatrical locked-off frontal compositions with abrupt physical crash zooms, low-angle product hero shots and one fast lateral tracking move following the crunch wave. Camera movement feels like a real late-1980s television studio production: deliberate tripod starts, quick mechanical zooms and slight operator settling rather than digital floating.

PHYSICS

The inflated package has realistic flexible plastic behavior, internal air pressure, wrinkles, inertia and soft rebound. Crisps remain rigid and brittle, with believable weight, collisions and crumbs. Miniature buildings and props visibly behave like handmade physical objects. Every movement has contact, mass and cause-and-effect.

LIGHTING

Hard, colorful retro studio lighting with warm cream highlights, saturated emerald shadows, lime-green accents and occasional pink flashes matching the "New!" starburst. Product shots use a controlled moving specular highlight that reveals the glossy plastic without obscuring the typography. The final packshot is clean, bright and premium, with a strong grounded shadow beneath the bag.

AUDIO

Fast original mix of retro synth-pop, Japanese television brass hits, funky bass and playful percussion. Exaggerated vending-machine clunks, foil tearing, package rustle, rhythmic miniature-city sounds and one exceptionally crisp bite: "ZAKU!" The music briefly drops out before the bite, then returns at full energy. Use only the two scripted Japanese announcer lines. No character dialogue and no additional voices.

POSITIVE LOCKS

The CRUNCHO package remains the hero and appears in the opening, center transformation and final frame. Its color, proportions, printed layout and flavor line remain faithful to <<<image_1>>>. All animated sequences are original and return to the same live-action product identity. The final frame is uncluttered and holds long enough to read the real packaging.`;

const SIPPO_EXAMPLE = `SCENE CONTEXT
A premium 30-second Japanese commercial for SIPPO Cherry: playful, surreal, fashion-forward and highly polished. Energetic pacing, wide-angle intimacy, colorful Japanese advertising language and inventive graphic transitions. Create original scenes, choreography, styling and compositions.

ACTIVE REFERENCE
<<<image_1>>> is the exact product reference and the visual source of truth. Preserve the small rectangular matte pink drink carton, its proportions, folded top, white bendable straw, striped sunset symbol, dark cherry-red SIPPO logo, Cherry label and two smiling cherries with green stems. Keep the packaging recognizable and unchanged in every shot. It remains a carton and never becomes a can, bottle or plastic container.

CHARACTERS
Four strikingly beautiful adult Japanese women, 22–28, with distinctive editorial identities: a sharp black bob with graphic eyeliner, a long raven ponytail with burgundy ribbons, a softly curled copper-brown bob, and sleek waist-length black hair with blunt bangs. Sophisticated Tokyo fashion styling in cherry red, powder pink, ivory and small chrome accents. Expressive eyes, charismatic micro-expressions, natural skin texture and believable friendship chemistry. Their faces remain attractive and anatomically stable during all wide-angle shots.

FIRST FRAME
The first visible frame already contains the SIPPO Cherry carton in the extreme foreground and the lead woman directly behind it. The carton fills the lower center of the frame while its complete front panel remains readable. No empty establishing shot and no delayed product reveal.

FORMAT MODE
A controlled multi-shot commercial with precisely motivated HARD CUTS, MATCH CUTS and WHIP CUTS. Every shot introduces a new visual idea while preserving the same product design, character identities, wardrobe continuity and cherry-pink color world. Energetic pacing with one longer final packshot.

ACTION AND CAMERA SEQUENCE
OPENING SHOT — 107° wide rectilinear view. The camera sits only 60 cm above a glossy powder-pink table, 70 cm from the product. The carton looms large in the immediate foreground while the lead woman leans toward the lens from midground, smiles mischievously and points directly at the straw. A rapid physical tabletop push-in ends with the straw passing close above the lens. Straight lines remain straight, with dynamic perspective but no fisheye bubble.

WHIP CUT — A cherry-red circular portal fills the frame. The camera bursts through it into a surreal Tokyo-inspired studio street built from cream walls, pink tiles, chrome rails and oversized round cherry sculptures. All four women stride toward camera in synchronized formation. Use an 84° classic wide field of view, camera at waist height moving backward on a stabilized dolly. Their foreground hands and fashion accessories feel large and energetic while faces remain near the center and flattering.

MATCH CUT — One woman passes the SIPPO carton through a round opening in a wall. The package crosses the lens and emerges into the hands of another woman in a completely different set: a polished retro Japanese photo booth in burgundy and pale pink. The camera performs a fast 180-degree orbit around her as she takes a refreshing sip through the straw and gives an unexpected confident side-eye to camera.

OVERHEAD SHOT — Perfect top-down view of the four women lying in a clean radial composition around a giant circular cherry-red platform. They pass the carton clockwise from hand to hand. The camera rotates gently in the opposite direction. Two real cherries roll across the platform and create a practical match transition.

PRODUCT SENSORY INSERTS — Controlled rapid macro cuts: tiny cold condensation beads sliding down the matte pink carton; the flexible ridges of the white straw bending naturally; fingertips lifting the package; a dark red cherry splitting open with glossy juice; the two smiling cherry characters and SIPPO logo remaining clean and faithful to <<<image_1>>>. Use 18° detail optics with precise rack focus and crisp commercial highlights.

LOW-ANGLE HERO SHOT — 107° wide rectilinear view from floor height. The four women form a loose diamond around the product pedestal. The lead steps across the lens, then the camera cranes rapidly upward between them as they turn and look directly into camera. Hair, fabric and jewelry react naturally with delayed physical motion. Their expressions shift from cool editorial confidence into spontaneous laughter.

FINAL GROUP SHOT — 84° wide view on a glossy cherry-red stage beneath an enormous soft circular light resembling the striped sunset symbol on the packaging. The camera makes a fast curved dolly move around the group. Each woman holds one identical SIPPO Cherry carton, then they bring the packages toward the center for a playful synchronized toast. Every carton remains correctly scaled and visually identical to <<<image_1>>>.

FINAL PACKSHOT — HARD CUT to a pristine cream-to-pink studio background. One exact SIPPO Cherry carton stands upright on a small mirror-polished pedestal, front panel facing camera. Two fresh cherries rest beside it. The white straw bends elegantly toward screen-right. A slow 29° short-telephoto push creates subtle premium parallax while the product stays razor-sharp. Hold this final composition long enough for clear brand recognition.

LIGHTING AND IMAGE QUALITY
High-end Japanese beauty-commercial lighting: large soft overhead source, clean pearlescent skin highlights, crisp cherry-red edge light and controlled reflections. Bright commercial exposure with rich burgundy reds, powder pink, warm cream and small chrome accents. The product receives its own precise soft key and remains the brightest, cleanest object whenever visible. Premium photorealistic footage, ARRI Alexa 35 texture, sharp art direction, subtle natural grain, polished color separation, high dynamic range and pristine advertising finish.

PHYSICS
Every package has consistent cardboard stiffness, weight and scale. Fingers create believable pressure against the carton. The straw bends only at its flexible ridges. Condensation follows gravity and leaves tiny wet trails. Hair, clothing, rolling cherries and camera-adjacent gestures have realistic inertia, contact and follow-through.

AUDIO
Original upbeat Japanese electro-pop and Shibuya-kei-inspired track with playful female vocal chops, punchy bass, handclaps and sparkling synth accents; no borrowed melody. Precisely synchronized camera-shutter clicks, straw flex, soft carton taps, cherry rolls, fabric swishes, fast transition whooshes and a clean refreshing sip. At the final group toast, the women joyfully chant together: "SIPPO Cherry!" The packshot ends with a short, memorable two-note sonic logo. No extra dialogue and no subtitles.`;

export const HOUSE_REFERENCE_PROMPTS: HouseReferencePrompt[] = [
  {
    genre: "product_reveal",
    cameraMotion: "Crash Zoom In / Match Cut",
    prompt: CRUNCHO_EXAMPLE,
  },
  {
    genre: "3d_mascot",
    cameraMotion: "Wide Rectilinear / Whip Cut / Orbit",
    prompt: SIPPO_EXAMPLE,
  },
];

/** Back-compat alias — videoReference.ts imports this name. */
export const HIGGSFIELD_REFERENCE_PROMPTS = HOUSE_REFERENCE_PROMPTS;
export type HiggsfieldReferencePrompt = HouseReferencePrompt;

/**
 * Picks reference examples for few-shot prompting.
 *
 * Default limit is 1: these examples run ~900 words each, and two of them plus
 * the video itself pushes the request large enough to hurt latency without
 * teaching the model anything the first example didn't.
 */
export function referencePromptsFor(genreHint: string, limit = 1): HouseReferencePrompt[] {
  const hint = genreHint.toLowerCase();
  const matched = HOUSE_REFERENCE_PROMPTS.filter(
    (p) => hint.includes(p.genre.replace(/_/g, " ")) || hint.includes(p.genre),
  );
  const rest = HOUSE_REFERENCE_PROMPTS.filter((p) => !matched.includes(p));
  return [...matched, ...rest].slice(0, Math.max(1, limit));
}
