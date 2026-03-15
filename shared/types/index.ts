export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL: string;
  lastLoginAt: Date;
}

export interface AvatarSettings {
  gender: string;
  ageRange: string;
  ethnicity: string;
  faceShape: string;
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  eyeColor: string;
  outfit: string;
  pose: string;
  expression: string;
  background: string;
  lighting: string;
  style: string;
}

export interface GeneratedAvatar {
  id: string;
  userId: string;
  name: string;
  prompt: string;
  imageUrl: string;
  settings: AvatarSettings;
  createdAt: Date;
}

export interface GeneratedAd {
  id: string;
  userId: string;
  productName: string;
  platform: string;
  imageUrl: string;
  adCopy: string;
  settings: Record<string, string>;
  createdAt: Date;
}

export interface ApiLogEntry {
  id: string;
  endpoint: string;
  method: string;
  userId?: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
}

export interface AdminStats {
  totalUsers: number;
  totalAvatars: number;
  totalAds: number;
  totalApiRequests: number;
}
