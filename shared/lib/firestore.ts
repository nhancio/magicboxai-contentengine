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
  serverTimestamp,
  getCountFromServer,
  setDoc,
  updateDoc,
  increment,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// Firestore rejects `undefined` values — strip them before writing
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

export interface InfluencerRecord {
  id?: string;
  userId: string;
  name: string;
  prompt: string;
  imageUrl: string;
  settings: Record<string, string>;
  createdAt?: Timestamp;
}

export interface AdRecord {
  id?: string;
  userId: string;
  productName: string;
  platform: string;
  imageUrl: string;
  adCopy: string;
  settings: Record<string, string>;
  createdAt?: Timestamp;
}

// --- Influencers ---
export async function saveInfluencer(data: Omit<InfluencerRecord, "id" | "createdAt">) {
  if (!db) throw new Error("Firestore not initialized");
  return addDoc(collection(db, "influencers"), stripUndefined({ ...data, createdAt: serverTimestamp() }));
}

export async function getInfluencers(userId: string): Promise<InfluencerRecord[]> {
  if (!db) return [];
  const q = query(collection(db, "influencers"), where("userId", "==", userId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as InfluencerRecord));
}

export async function deleteInfluencer(id: string) {
  if (!db) throw new Error("Firestore not initialized");
  await deleteDoc(doc(db, "influencers", id));
}

// --- Ads ---
export async function saveAd(data: Omit<AdRecord, "id" | "createdAt">) {
  if (!db) throw new Error("Firestore not initialized");
  return addDoc(collection(db, "ads"), stripUndefined({ ...data, createdAt: serverTimestamp() }));
}

export async function getAds(userId: string): Promise<AdRecord[]> {
  if (!db) return [];
  const q = query(collection(db, "ads"), where("userId", "==", userId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdRecord));
}

export async function deleteAd(id: string) {
  if (!db) throw new Error("Firestore not initialized");
  await deleteDoc(doc(db, "ads", id));
}

// --- Photo Avatars ---
export interface PhotoAvatarRecord {
  id?: string;
  userId: string;
  name: string;
  photoUrls: string[];
  photoStoragePaths?: string[];
  description: string;
  personality: string;
  voiceTone: string;
  videoUrl?: string;
  previewStatus?: "pending" | "completed" | "failed";
  previewError?: string;
  status: "processing" | "ready" | "failed";
  createdAt?: Timestamp;
}

export async function savePhotoAvatar(data: Omit<PhotoAvatarRecord, "id" | "createdAt">) {
  if (!db) throw new Error("Firestore not initialized");
  const docRef = await addDoc(collection(db, "photoAvatars"), stripUndefined({ ...data, createdAt: serverTimestamp() }));
  return docRef;
}

export async function getPhotoAvatars(userId: string): Promise<PhotoAvatarRecord[]> {
  if (!db) return [];
  const q = query(collection(db, "photoAvatars"), where("userId", "==", userId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PhotoAvatarRecord));
}

export async function deletePhotoAvatar(id: string) {
  if (!db) throw new Error("Firestore not initialized");
  await deleteDoc(doc(db, "photoAvatars", id));
}

export async function updatePhotoAvatarStatus(id: string, status: "processing" | "ready" | "failed") {
  if (!db) throw new Error("Firestore not initialized");
  await updateDoc(doc(db, "photoAvatars", id), { status });
}

// --- Videos ---
export interface VideoRecord {
  id?: string;
  userId: string;
  avatarId: string;
  avatarName: string;
  templateId: string;
  templateName: string;
  productName: string;
  productDescription: string;
  productImageUrl?: string;
  script: string;
  hookLine: string;
  captions: string[];
  cta: string;
  platform: string;
  tone: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  renderProvider?: "veo" | "remotion";
  errorMessage?: string;
  previewVideoUrl?: string;
  status: "queued" | "generating" | "completed" | "failed";
  createdAt?: Timestamp;
}

export async function saveVideo(data: Omit<VideoRecord, "id" | "createdAt">) {
  if (!db) throw new Error("Firestore not initialized");
  return addDoc(collection(db, "videos"), stripUndefined({ ...data, createdAt: serverTimestamp() }));
}

export async function updateVideo(id: string, data: Partial<Omit<VideoRecord, "id" | "createdAt">>) {
  if (!db) throw new Error("Firestore not initialized");
  await updateDoc(doc(db, "videos", id), stripUndefined(data as Record<string, unknown>));
}

export async function getVideos(userId: string): Promise<VideoRecord[]> {
  if (!db) return [];
  const q = query(collection(db, "videos"), where("userId", "==", userId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VideoRecord));
}

export async function deleteVideo(id: string) {
  if (!db) throw new Error("Firestore not initialized");
  await deleteDoc(doc(db, "videos", id));
}

// --- Subscriptions & Usage ---
export interface SubscriptionRecord {
  plan: "free" | "pro" | "max";
  videosUsed: number;
  videosLimit: number;
  status?: "inactive" | "active" | "past_due" | "cancelled";
  razorpayOrderId?: string;
  razorpaySubscriptionId?: string;
  razorpayCustomerId?: string;
  currentPeriodEnd?: Timestamp;
  provider?: "dodo";
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  providerProductId?: string;
}

export async function getUserSubscription(userId: string): Promise<SubscriptionRecord> {
  if (!db) return { plan: "free", videosUsed: 0, videosLimit: 0 };
  const docRef = doc(db, "subscriptions", userId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    return { plan: "free", videosUsed: 0, videosLimit: 0 };
  }
  return snap.data() as SubscriptionRecord;
}

export async function setUserSubscription(userId: string, data: Partial<SubscriptionRecord>) {
  if (!db) throw new Error("Firestore not initialized");
  await setDoc(doc(db, "subscriptions", userId), data, { merge: true });
}

export async function incrementVideoUsage(userId: string) {
  if (!db) throw new Error("Firestore not initialized");
  await updateDoc(doc(db, "subscriptions", userId), { videosUsed: increment(1) });
}

export async function canGenerateVideo(userId: string): Promise<boolean> {
  const sub = await getUserSubscription(userId);
  if (sub.plan === "free") return false;
  return sub.videosUsed < sub.videosLimit;
}

// --- Admin Stats ---
export async function getTotalUsers(): Promise<number> {
  if (!db) return 0;
  const snap = await getCountFromServer(collection(db, "users"));
  return snap.data().count;
}

export async function getTotalInfluencers(): Promise<number> {
  if (!db) return 0;
  const snap = await getCountFromServer(collection(db, "influencers"));
  return snap.data().count;
}

export async function getTotalAds(): Promise<number> {
  if (!db) return 0;
  const snap = await getCountFromServer(collection(db, "ads"));
  return snap.data().count;
}

export async function getRecentUsers(limitCount = 10) {
  if (!db) return [];
  const q = query(collection(db, "users"), orderBy("lastLoginAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.slice(0, limitCount).map((d) => ({ id: d.id, ...d.data() }));
}

export async function getRecentInfluencers(limitCount = 10) {
  if (!db) return [];
  const q = query(collection(db, "influencers"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.slice(0, limitCount).map((d) => ({ id: d.id, ...d.data() }));
}

// --- API Request Logging ---
export async function logApiRequest(data: {
  endpoint: string;
  method: string;
  userId?: string;
  statusCode: number;
  duration: number;
}) {
  if (!db) return;
  await addDoc(collection(db, "apiLogs"), { ...data, timestamp: serverTimestamp() });
}

export async function getApiLogs(limitCount = 50) {
  if (!db) return [];
  const q = query(collection(db, "apiLogs"), orderBy("timestamp", "desc"));
  const snap = await getDocs(q);
  return snap.docs.slice(0, limitCount).map((d) => ({ id: d.id, ...d.data() }));
}

export async function getTotalApiRequests(): Promise<number> {
  if (!db) return 0;
  const snap = await getCountFromServer(collection(db, "apiLogs"));
  return snap.data().count;
}
