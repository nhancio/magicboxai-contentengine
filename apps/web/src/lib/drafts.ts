import { useCallback, useRef, useState } from "react";

/**
 * Draft persistence for Studio and the automation wizard.
 *
 * Generation itself already runs on the backend (Convex actions and `mediaJobs`
 * keep going when a page unmounts), so the only thing lost on navigation is the
 * client's copy of the work. Everything here mirrors that client state so a
 * page can pick up where it left off.
 *
 * ponytail: drafts are per-browser (localStorage), so they don't follow the user
 * to another device. Move the payloads into a Convex `drafts` table if that's
 * needed.
 */

const NS = "magicbox";

export function readPersisted<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writePersisted(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage disabled or full — drafts are a convenience, never block the UI.
  }
}

export function clearPersisted(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * `useState` mirrored to localStorage. The write happens inside the setter
 * rather than in an effect, so a generation that finishes *after* the user
 * navigated away still records its result for when they come back.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readPersisted(key, initial));
  const latest = useRef(value);
  latest.current = value;

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === "function" ? (next as (prev: T) => T)(latest.current) : next;
      latest.current = resolved;
      writePersisted(key, resolved);
      setValue(resolved);
    },
    [key],
  );

  return [value, set] as const;
}

/* ---------------------------------- Studio --------------------------------- */

const STUDIO_FIELDS = [
  "channel",
  "postType",
  "selectedPresetId",
  "prompt",
  "tone",
  "avatarId",
  "media",
  "videoJobId",
  "caption",
  "hashtags",
  "isRenderingMedia",
  "whatsappRecipients",
  "whatsappTemplateName",
] as const;

export type StudioField = (typeof STUDIO_FIELDS)[number];

/**
 * Studio sessions — one saved post-in-progress each, like chat threads.
 *
 * Every field is stored per session, so switching sessions is just a remount
 * against a different key prefix. The active session id is itself persisted, so
 * a reload lands back where the user left off.
 *
 * ponytail: sessions live in localStorage (per browser, like the rest of drafts);
 * move them to a Convex table when they need to follow the user across devices.
 */
export type StudioSession = { id: string; title: string; updatedAt: number };

export const studioSessionsKey = (uid: string) => `${NS}:studio-sessions:${uid}`;
export const studioActiveSessionKey = (uid: string) => `${NS}:studio-active:${uid}`;

export const studioKey = (uid: string, field: StudioField, sessionId?: string) =>
  sessionId ? `${NS}:studio:${uid}:${sessionId}:${field}` : `${NS}:studio:${uid}:${field}`;

export function readStudioSessions(uid: string): StudioSession[] {
  return readPersisted<StudioSession[]>(studioSessionsKey(uid), []);
}

export function writeStudioSessions(uid: string, sessions: StudioSession[]): void {
  writePersisted(studioSessionsKey(uid), sessions);
}

export function deleteStudioSession(uid: string, sessionId: string): void {
  for (const field of STUDIO_FIELDS) clearPersisted(studioKey(uid, field, sessionId));
  writeStudioSessions(
    uid,
    readStudioSessions(uid).filter((s) => s.id !== sessionId),
  );
}

export type StudioDraftSummary = {
  channel: string;
  postType: string;
  prompt: string;
  caption: string;
  hasMedia: boolean;
};

/** The in-progress Studio post, or null when there's nothing worth resuming. */
export function readStudioDraft(uid: string): StudioDraftSummary | null {
  const sid = readPersisted<string>(studioActiveSessionKey(uid), "");
  const at = (field: StudioField) => studioKey(uid, field, sid || undefined);
  const prompt = readPersisted(at("prompt"), "");
  const caption = readPersisted(at("caption"), "");
  const media = readPersisted<{ url: string } | null>(at("media"), null);
  if (!prompt.trim() && !caption.trim() && !media) return null;
  return {
    channel: readPersisted(at("channel"), "instagram"),
    postType: readPersisted(at("postType"), "image"),
    prompt,
    caption,
    hasMedia: Boolean(media),
  };
}

export function clearStudioDraft(uid: string): void {
  const sid = readPersisted<string>(studioActiveSessionKey(uid), "");
  for (const field of STUDIO_FIELDS) clearPersisted(studioKey(uid, field, sid || undefined));
}

/* -------------------------------- Automation ------------------------------- */

/** Wizard step labels, shared so the drafts list can name the step it stopped on. */
export const AUTOMATION_STEPS = ["Brief", "Channels", "Content", "Schedule", "Review"] as const;

export type AutomationDraft = {
  step: number;
  name: string;
  brief: string;
  preset: string;
  tone: string;
  brandProfileId: string;
  selectedAccounts: string[];
  withImage: boolean;
  withVideo: boolean;
  requiresApproval: boolean;
  time: string;
  daysOfWeek: number[];
  updatedAt: number;
};

export const automationDraftKey = (uid: string) => `${NS}:automation-draft:${uid}`;

export function readAutomationDraft(uid: string): AutomationDraft | null {
  const draft = readPersisted<AutomationDraft | null>(automationDraftKey(uid), null);
  if (!draft || (!draft.name?.trim() && !draft.brief?.trim())) return null;
  return draft;
}

export function clearAutomationDraft(uid: string): void {
  clearPersisted(automationDraftKey(uid));
}
