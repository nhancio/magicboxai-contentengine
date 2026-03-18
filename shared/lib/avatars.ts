export interface PrebuiltAvatar {
  id: string;
  name: string;
  personality: string;
  voiceTone: string;
  description: string;
  useCases: string[];
  gradient: string;
  emoji: string;
  age: string;
  style: string;
}

export const PREBUILT_AVATARS: PrebuiltAvatar[] = [
  {
    id: "avatar-genz-girl",
    name: "Zara",
    personality: "GenZ Girl",
    voiceTone: "Energetic, trendy, uses current slang",
    description: "The relatable GenZ creator who makes everything feel authentic and fun. Perfect for beauty, fashion, and lifestyle products.",
    useCases: ["Beauty", "Fashion", "Lifestyle", "Skincare"],
    gradient: "from-pink-500 to-rose-600",
    emoji: "Z",
    age: "20",
    style: "Trendy & Casual",
  },
  {
    id: "avatar-tech-bro",
    name: "Marcus",
    personality: "Tech Bro",
    voiceTone: "Confident, analytical, slightly nerdy but cool",
    description: "The tech-savvy reviewer who breaks down products with authority. Ideal for SaaS, gadgets, and productivity tools.",
    useCases: ["SaaS", "Tech Gadgets", "Productivity", "Apps"],
    gradient: "from-blue-500 to-indigo-600",
    emoji: "M",
    age: "28",
    style: "Smart Casual",
  },
  {
    id: "avatar-luxury-influencer",
    name: "Victoria",
    personality: "Luxury Influencer",
    voiceTone: "Sophisticated, aspirational, polished",
    description: "The premium lifestyle creator who makes everything feel exclusive. Best for luxury brands, premium products, and high-end services.",
    useCases: ["Luxury Brands", "Premium Products", "Real Estate", "Jewelry"],
    gradient: "from-amber-500 to-yellow-600",
    emoji: "V",
    age: "32",
    style: "Elegant & Premium",
  },
  {
    id: "avatar-fitness-coach",
    name: "Tyler",
    personality: "Fitness Coach",
    voiceTone: "Motivational, high-energy, direct",
    description: "The fitness-obsessed motivator who brings intensity and authenticity. Perfect for supplements, fitness gear, and health products.",
    useCases: ["Supplements", "Fitness Gear", "Health Food", "Workout Apps"],
    gradient: "from-emerald-500 to-green-600",
    emoji: "T",
    age: "26",
    style: "Athletic & Active",
  },
  {
    id: "avatar-mom-influencer",
    name: "Sarah",
    personality: "Relatable Mom",
    voiceTone: "Warm, honest, down-to-earth, slightly humorous",
    description: "The everyday mom who gives honest reviews. Ideal for family products, home goods, and anything parents need.",
    useCases: ["Baby Products", "Home Goods", "Family Apps", "Kitchen Gadgets"],
    gradient: "from-violet-500 to-purple-600",
    emoji: "S",
    age: "34",
    style: "Casual & Approachable",
  },
  {
    id: "avatar-hustler",
    name: "Alex",
    personality: "Entrepreneur / Hustler",
    voiceTone: "Bold, urgent, motivational, slightly aggressive",
    description: "The hustle culture creator who sells with urgency and FOMO. Best for courses, business tools, and money-making products.",
    useCases: ["Online Courses", "Business Tools", "Investing", "Side Hustles"],
    gradient: "from-orange-500 to-red-600",
    emoji: "A",
    age: "30",
    style: "Bold & Confident",
  },
  {
    id: "avatar-aesthetic-girl",
    name: "Luna",
    personality: "Aesthetic Creator",
    voiceTone: "Soft, dreamy, ASMR-like, visually focused",
    description: "The aesthetic content creator who makes everything look beautiful. Perfect for home decor, stationery, and visual products.",
    useCases: ["Home Decor", "Stationery", "Art Supplies", "Candles"],
    gradient: "from-fuchsia-500 to-pink-600",
    emoji: "L",
    age: "24",
    style: "Aesthetic & Minimal",
  },
  {
    id: "avatar-funny-guy",
    name: "Jake",
    personality: "Comedy Creator",
    voiceTone: "Witty, sarcastic, self-deprecating humor",
    description: "The funny creator who makes ads entertaining. Ideal for any product that benefits from humor-driven content.",
    useCases: ["Food & Beverage", "Apps", "Subscriptions", "Any Product"],
    gradient: "from-cyan-500 to-teal-600",
    emoji: "J",
    age: "27",
    style: "Casual & Fun",
  },
];

export function getAvatarById(id: string): PrebuiltAvatar | undefined {
  return PREBUILT_AVATARS.find((a) => a.id === id);
}

export function getAvatarsByUseCase(useCase: string): PrebuiltAvatar[] {
  return PREBUILT_AVATARS.filter((a) =>
    a.useCases.some((uc) => uc.toLowerCase().includes(useCase.toLowerCase()))
  );
}
