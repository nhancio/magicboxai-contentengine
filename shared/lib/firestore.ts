import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  getCountFromServer,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

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
  return addDoc(collection(db, "influencers"), { ...data, createdAt: serverTimestamp() });
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
  return addDoc(collection(db, "ads"), { ...data, createdAt: serverTimestamp() });
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
