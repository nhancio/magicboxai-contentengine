import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  setDoc,
  updateDoc,
  onSnapshot,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  SocialAccount,
  BrandProfile,
  Automation,
  Post,
  PostStatus,
  SocialPlatform,
} from "../types";

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

function toDate(v: unknown): Date | undefined {
  if (!v) return undefined;
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return undefined;
}

// --- Social Accounts (synced from Post Bridge by the backend) ---

export async function getSocialAccounts(userId: string): Promise<SocialAccount[]> {
  if (!db) return [];
  const q = query(collection(db, "socialAccounts"), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      ...data,
      id: d.id,
      linkedAt: toDate(data.linkedAt) ?? new Date(),
      lastSyncedAt: toDate(data.lastSyncedAt),
    } as SocialAccount;
  });
}

// --- Brand Profiles ---

export async function saveBrandProfile(
  data: Omit<BrandProfile, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  if (!db) throw new Error("Firestore not initialized");
  const ref = await addDoc(
    collection(db, "brandProfiles"),
    stripUndefined({ ...data, createdAt: serverTimestamp() })
  );
  return ref.id;
}

export async function updateBrandProfile(
  id: string,
  data: Partial<Omit<BrandProfile, "id" | "createdAt">>
) {
  if (!db) throw new Error("Firestore not initialized");
  await updateDoc(
    doc(db, "brandProfiles", id),
    stripUndefined({ ...data, updatedAt: serverTimestamp() } as Record<string, unknown>)
  );
}

export async function getBrandProfiles(userId: string): Promise<BrandProfile[]> {
  if (!db) return [];
  const q = query(collection(db, "brandProfiles"), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      ...data,
      id: d.id,
      createdAt: toDate(data.createdAt) ?? new Date(),
      updatedAt: toDate(data.updatedAt),
    } as BrandProfile;
  });
}

export async function deleteBrandProfile(id: string) {
  if (!db) throw new Error("Firestore not initialized");
  await deleteDoc(doc(db, "brandProfiles", id));
}

// --- Automations ---
// Creation/updates go through the `createAutomation` / `updateAutomation`
// callables (which validate the schedule and compute nextRunAt); these
// helpers are read-side plus lightweight status toggles.

export async function getAutomations(userId: string): Promise<Automation[]> {
  if (!db) return [];
  const q = query(collection(db, "automations"), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        ...data,
        id: d.id,
        nextRunAt: toDate(data.nextRunAt) ?? new Date(),
        lastRunAt: toDate(data.lastRunAt),
        createdAt: toDate(data.createdAt) ?? new Date(),
        updatedAt: toDate(data.updatedAt),
      } as Automation;
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getAutomation(id: string): Promise<Automation | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, "automations", id));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    ...data,
    id: snap.id,
    nextRunAt: toDate(data.nextRunAt) ?? new Date(),
    lastRunAt: toDate(data.lastRunAt),
    createdAt: toDate(data.createdAt) ?? new Date(),
    updatedAt: toDate(data.updatedAt),
  } as Automation;
}

export async function setAutomationStatus(id: string, status: "active" | "paused") {
  if (!db) throw new Error("Firestore not initialized");
  await updateDoc(doc(db, "automations", id), { status, updatedAt: serverTimestamp() });
}

export async function deleteAutomation(id: string) {
  if (!db) throw new Error("Firestore not initialized");
  await deleteDoc(doc(db, "automations", id));
}

// --- Posts ---

function mapPost(id: string, data: Record<string, unknown>): Post {
  return {
    ...data,
    id,
    scheduledFor: toDate(data.scheduledFor) ?? new Date(),
    nextAttemptAt: toDate(data.nextAttemptAt),
    createdAt: toDate(data.createdAt) ?? new Date(),
    updatedAt: toDate(data.updatedAt),
  } as Post;
}

export async function getPosts(userId: string, max = 100): Promise<Post[]> {
  if (!db) return [];
  const q = query(
    collection(db, "posts"),
    where("userId", "==", userId),
    orderBy("scheduledFor", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapPost(d.id, d.data()));
}

export async function getPostsByStatus(
  userId: string,
  statuses: PostStatus[],
  max = 100
): Promise<Post[]> {
  if (!db) return [];
  const q = query(
    collection(db, "posts"),
    where("userId", "==", userId),
    where("status", "in", statuses),
    orderBy("scheduledFor", "asc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapPost(d.id, d.data()));
}

export async function getPostsInRange(
  userId: string,
  start: Date,
  end: Date
): Promise<Post[]> {
  if (!db) return [];
  const q = query(
    collection(db, "posts"),
    where("userId", "==", userId),
    where("scheduledFor", ">=", Timestamp.fromDate(start)),
    where("scheduledFor", "<=", Timestamp.fromDate(end)),
    orderBy("scheduledFor", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapPost(d.id, d.data()));
}

export function watchPost(id: string, cb: (post: Post | null) => void): Unsubscribe {
  if (!db) return () => {};
  return onSnapshot(doc(db, "posts", id), (snap) => {
    cb(snap.exists() ? mapPost(snap.id, snap.data()) : null);
  });
}

/** Manual post creation (from ContentStudio / VideoCreator "Schedule this"). */
export async function createManualPost(data: {
  userId: string;
  scheduledFor: Date;
  timezone: string;
  brief: string;
  platforms: SocialPlatform[];
  socialAccountIds: string[];
  content?: Post["content"];
  media?: Post["media"];
  brandProfileId?: string;
}): Promise<string> {
  if (!db) throw new Error("Firestore not initialized");
  const ref = doc(collection(db, "posts"));
  await setDoc(
    ref,
    stripUndefined({
      ...data,
      source: "manual",
      scheduledFor: Timestamp.fromDate(data.scheduledFor),
      // manual posts with content already attached skip generation
      status: data.content ? "ready" : "scheduled",
      attempts: 0,
      maxAttempts: 3,
      createdAt: serverTimestamp(),
    })
  );
  return ref.id;
}
