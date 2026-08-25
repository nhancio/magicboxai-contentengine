import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { isConvexConfigured } from "../lib/convex";
import { useAuth } from "@shared/lib/auth";
import { captureEvent } from "@shared/lib/analytics";
import { Button } from "@shared/components/ui/button";
import { Badge } from "@shared/components/ui/badge";
import { Input } from "@shared/components/ui/input";
import { Label } from "@shared/components/ui/label";
import { Textarea } from "@shared/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@shared/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@shared/components/ui/tabs";
import { cn } from "@shared/lib/utils";
import {
  Flame,
  Instagram,
  Youtube,
  CheckCircle2,
  Shield,
  ShoppingBag,
  ArrowRight,
  Clock,
  Search,
  Loader2,
  XCircle,
  TrendingUp,
  PlusCircle,
  DollarSign,
  Eye,
  ThumbsUp,
  Tag,
  Mail,
  FileText,
  AlertCircle,
  CalendarClock,
  Building2,
  Star,
  Users,
} from "lucide-react";

/** Appointment URL for custom enterprise or bulk account requests */
const BOOK_APPOINTMENT_URL = "https://calendar.app.google/TH9bgDRMEdDpLvD68";

export type PlatformType = "all" | "instagram" | "youtube";

export interface AccountOption {
  id: string;
  platform: "instagram" | "youtube";
  title: string;
  /** Handle shown on the card — the listing's identity, assigned at transfer. */
  username: string;
  /** Average views per post / video over the last 30 days. */
  avgViews: number;
  followersCount: string;
  followerNum: number;
  age: string;
  trustScore: number;
  price: number;
  badge?: string;
  popular?: boolean;
  nicheOptions: string[];
  features: string[];
}

const NICHE_PRESETS = [
  "Fitness & Wellness",
  "Tech & SaaS",
  "Business & Finance",
  "Lifestyle & Creator",
  "E-Commerce & Brands",
  "AI & Innovation",
  "Gaming & Entertainment",
  "Fashion & Beauty",
  "Food & Travel",
];

const ACCOUNTS_CATALOG: AccountOption[] = [
  {
    id: "ig-5k-creator",
    platform: "instagram",
    title: "Instagram 5K Aged Creator",
    username: "@aged.creator.5k",
    avgViews: 3200,
    followersCount: "5,000",
    followerNum: 5000,
    age: "6+ Months Aged",
    trustScore: 98,
    price: 10,
    badge: "Fast Delivery",
    nicheOptions: ["Lifestyle & Creator", "Tech & SaaS", "Business & Finance", "Fitness & Wellness"],
    features: [
      "0-day warmup needed — start posting immediately",
      "Story & Reel engagement baseline established",
      "Phone-verified account (PVA) with spotless IP history",
      "1-Click Connector for MagicBox Studio & Maya AI",
      "Full primary email & 2FA ownership transfer",
      "30-Day unconditional replacement warranty",
    ],
  },
  {
    id: "ig-10k-growth",
    platform: "instagram",
    title: "Instagram 10K Growth Account",
    username: "@growth.hub.10k",
    avgViews: 7400,
    followersCount: "10,000",
    followerNum: 10000,
    age: "12+ Months Aged",
    trustScore: 100,
    price: 10,
    badge: "Best Value",
    popular: true,
    nicheOptions: ["Business & E-Commerce", "SaaS & AI", "Fashion & Lifestyle", "Entertainment"],
    features: [
      "Link sticker / Swipe-up enabled on Stories",
      "High retention Reel algorithm authority score",
      "Zero shadowban or strike history in lifetime",
      "Auto-publishes seamlessly via Maya Automations",
      "Verified clean IP history across US/EU servers",
      "30-Day unconditional replacement warranty",
    ],
  },
  {
    id: "yt-5k-shorts",
    platform: "youtube",
    title: "YouTube 5K Shorts & Video Channel",
    username: "@shorts.studio5k",
    avgViews: 4100,
    followersCount: "5,000",
    followerNum: 5000,
    age: "8+ Months Aged",
    trustScore: 99,
    price: 10,
    badge: "Shorts Warmed",
    nicheOptions: ["Tech & Tutorials", "Gaming & Entertainment", "Business & Advice", "Short Clips"],
    features: [
      "Shorts algorithm pre-warmed for instant reach",
      "Clean copyright & community guidelines record",
      "Binds directly to MagicBox Video Creator & Studio",
      "Phone-verified Google Account credentials",
      "Smooth ownership transfer to your Brand Account",
      "30-Day unconditional replacement warranty",
    ],
  },
  {
    id: "yt-10k-authority",
    platform: "youtube",
    title: "YouTube 10K Authority Channel",
    username: "@authority.ch10k",
    avgViews: 9600,
    followersCount: "10,000",
    followerNum: 10000,
    age: "14+ Months Aged",
    trustScore: 100,
    price: 10,
    badge: "High Authority",
    popular: true,
    nicheOptions: ["Tech & Software", "Education & Media", "General / Vlogs", "Finance & Crypto"],
    features: [
      "Community Tab enabled for rich audience polls",
      "Monetization eligible baseline metrics",
      "Seamless auto-publishing sync with MagicBox Studio",
      "Clean organic upload history & zero strikes",
      "Dedicated 1-on-1 account transfer guidance",
      "30-Day unconditional replacement warranty",
    ],
  },
  {
    id: "ig-5k-viral",
    platform: "instagram",
    title: "Instagram 5K Viral Reels Account",
    username: "@viral.reels.5k",
    avgViews: 5800,
    followersCount: "5,000",
    followerNum: 5000,
    age: "7+ Months Aged",
    trustScore: 98,
    price: 10,
    badge: "High Reach",
    nicheOptions: ["AI Tools & Tech", "Quotes & Motivation", "E-Commerce", "General Lifestyle"],
    features: [
      "Pre-warmed Reel recommendation score",
      "High daily posting tolerance (up to 10 posts/day)",
      "Instant OAuth / API integration for MagicBox",
      "Phone & email verified (PVA)",
      "Full ownership transfer guaranteed",
      "30-Day unconditional replacement warranty",
    ],
  },
  {
    id: "yt-10k-shorts-hub",
    platform: "youtube",
    title: "YouTube 10K Shorts Growth Hub",
    username: "@shorts.growth10k",
    avgViews: 12500,
    followersCount: "10,000",
    followerNum: 10000,
    age: "10+ Months Aged",
    trustScore: 99,
    price: 10,
    badge: "Viral Ready",
    nicheOptions: ["Shorts & Clips", "Tech & AI", "Entertainment", "Podcast Clips"],
    features: [
      "Multi-thousand daily Shorts impression baseline",
      "Direct auto-publishing via MagicBox Automations",
      "No strike history or copyright claims",
      "Full Google Channel owner transfer",
      "Instant setup with MagicBox workflow",
      "30-Day unconditional replacement warranty",
    ],
  },
];

const FAQS = [
  {
    question: "How are these accounts warmed up and why is there no shadowban risk?",
    answer:
      "All accounts in our catalog are aged 6 to 14+ months with real organic interaction history, verified phone credentials (PVA), and clean IP records. Unlike fresh accounts that trigger rate-limits, these aged accounts are recognized as high-trust authority nodes by Instagram and YouTube algorithms.",
  },
  {
    question: "How does the Account Listing feature work for account sellers?",
    answer:
      "If you own a warmed-up Instagram account or YouTube channel with 5K+ followers, you can submit it for sale directly on MagicBox. Our review team verifies ownership and engagement metrics. Once verified, your account is listed in the Community Marketplace for buyers.",
  },
  {
    question: "How does the MagicBox 1-Click Connector work?",
    answer:
      "Once you select an account, our automated credential vault binds the account's OAuth or session token directly into your MagicBox workspace. Maya AI and Content Studio can start publishing videos, carousels, and posts immediately without requiring manual daily logins.",
  },
  {
    question: "What is included with the $10 flat pricing?",
    answer:
      "For a single $10 fee, you receive full ownership transfer of the aged account, verified primary credentials, instant connector integration into MagicBox, and our 30-Day Unconditional Replacement Protection.",
  },
  {
    question: "What happens if an account experiences an issue during transfer?",
    answer:
      "Every purchase includes a 30-day replacement guarantee. If any account encounters a credential lock or verification issue during the first 30 days, our support team immediately replaces it with an equivalent or higher tier account free of charge.",
  },
];

export default function WarmedUpAccounts() {
  const { user } = useAuth();
  const [activeViewTab, setActiveViewTab] = useState<"catalog" | "community" | "my_submissions">("catalog");
  const [platformFilter, setPlatformFilter] = useState<PlatformType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<AccountOption | null>(null);
  const [selectedNiche, setSelectedNiche] = useState<string>("");
  const [autoBindWorkflow, setAutoBindWorkflow] = useState(true);
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [purchasedIds, setPurchasedIds] = useState<string[]>([]);
  const hasTrackedView = useRef(false);

  // Submit Listing Modal State
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [formPlatform, setFormPlatform] = useState<"instagram" | "youtube">("instagram");
  const [formTitle, setFormTitle] = useState("");
  const [formHandle, setFormHandle] = useState("");
  const [formFollowers, setFormFollowers] = useState<number>(5000);
  const [formAvgViews, setFormAvgViews] = useState<number>(2500);
  const [formAvgLikes, setFormAvgLikes] = useState<number>(350);
  const [formEngagementRate, setFormEngagementRate] = useState("4.2%");
  const [formAgeMonths, setFormAgeMonths] = useState<number>(8);
  const [formNiche, setFormNiche] = useState("Fitness & Wellness");
  const [formAskingPrice, setFormAskingPrice] = useState<number>(10);
  const [formContactEmail, setFormContactEmail] = useState(user?.email || "");
  const [formTransferNotes, setFormTransferNotes] = useState("");
  const [isSubmittingListing, setIsSubmittingListing] = useState(false);

  // Convex Queries & Mutations
  const communityListings = useQuery(
    api.warmedAccountListings.listListings,
    isConvexConfigured ? { status: "all" } : "skip"
  );

  const mySubmissions = useQuery(
    api.warmedAccountListings.listListings,
    isConvexConfigured ? { mySubmissionsOnly: true } : "skip"
  );

  const submitListingMutation = useMutation(
    api.warmedAccountListings.submitListing
  );

  const updateStatusMutation = useMutation(
    api.warmedAccountListings.updateListingStatus
  );

  useEffect(() => {
    if (user?.email && !formContactEmail) {
      setFormContactEmail(user.email);
    }
  }, [user, formContactEmail]);

  useEffect(() => {
    if (hasTrackedView.current) return;
    hasTrackedView.current = true;
    captureEvent("warmed_up_accounts_viewed", { surface: "app" });
  }, []);

  const filteredCatalog = ACCOUNTS_CATALOG.filter((acc) => {
    const matchesPlatform = platformFilter === "all" || acc.platform === platformFilter;
    const matchesSearch =
      acc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.followersCount.includes(searchQuery) ||
      acc.nicheOptions.some((n) => n.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesPlatform && matchesSearch;
  });

  const verifiedCommunityListings = (communityListings || []).filter((item) => {
    const matchesPlatform = platformFilter === "all" || item.platform === platformFilter;
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.niche.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.handleOrUrl.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPlatform && matchesSearch;
  });

  const handleOpenDialog = (acc: AccountOption) => {
    setSelectedAccount(acc);
    setSelectedNiche(acc.nicheOptions[0] || "General");
    setAutoBindWorkflow(true);
    setOrderSuccess(false);
    captureEvent("warmed_up_account_selected", {
      accountId: acc.id,
      platform: acc.platform,
      followers: acc.followersCount,
    });
  };

  const handleConfirmOrder = async () => {
    if (!selectedAccount) return;
    setIsOrdering(true);
    captureEvent("warmed_up_account_checkout_started", {
      accountId: selectedAccount.id,
      platform: selectedAccount.platform,
      price: selectedAccount.price,
      niche: selectedNiche,
      autoBind: autoBindWorkflow,
    });

    await new Promise((resolve) => setTimeout(resolve, 1200));

    setIsOrdering(false);
    setOrderSuccess(true);
    setPurchasedIds((prev) => [...prev, selectedAccount.id]);
    toast.success(`${selectedAccount.title} reserved & connected to MagicBox!`, {
      description: "Credentials and API keys have been bound to your Maya workspace.",
    });
  };

  const handleSubmitListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formHandle.trim() || !formContactEmail.trim()) {
      toast.error("Please complete all required fields.");
      return;
    }

    setIsSubmittingListing(true);
    captureEvent("warmed_account_listing_submitted", {
      platform: formPlatform,
      followers: formFollowers,
      askingPrice: formAskingPrice,
      niche: formNiche,
    });

    try {
      if (isConvexConfigured) {
        await submitListingMutation({
          platform: formPlatform,
          title: formTitle.trim(),
          handleOrUrl: formHandle.trim(),
          followerCount: Number(formFollowers),
          followerCountLabel: formFollowers >= 1000 ? `${(formFollowers / 1000).toFixed(0)}K` : `${formFollowers}`,
          avgViews: Number(formAvgViews),
          avgLikes: Number(formAvgLikes),
          engagementRate: formEngagementRate,
          accountAgeMonths: Number(formAgeMonths),
          niche: formNiche,
          askingPrice: Number(formAskingPrice),
          contactEmail: formContactEmail.trim(),
          transferNotes: formTransferNotes.trim() || undefined,
        });
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      toast.success("Account Listing Submitted!", {
        description: "Your listing is now under review. You can track its verification status in 'My Submissions'.",
      });

      // Reset form & view
      setFormTitle("");
      setFormHandle("");
      setFormTransferNotes("");
      setIsSellModalOpen(false);
      setActiveViewTab("my_submissions");
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit account listing. Please try again.");
    } finally {
      setIsSubmittingListing(false);
    }
  };

  const handleMarkAsSold = async (id: any) => {
    try {
      if (isConvexConfigured) {
        await updateStatusMutation({
          id,
          status: "sold",
        });
      }
      toast.success("Listing marked as Sold!");
    } catch (err: any) {
      toast.error(err?.message || "Could not update status.");
    }
  };

  const openBooking = (source: string) => {
    captureEvent("book_appointment_clicked", { source });
    window.open(BOOK_APPOINTMENT_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 animate-fade-in pb-12">
      {/* Top Banner & Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand/10 via-card to-background p-6 sm:p-10 shadow-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 h-64 w-64 rounded-full bg-brand/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-4xl space-y-4">
          <span className="eyebrow bg-brand/15 text-brand border-brand/20">
            <Flame className="w-3.5 h-3.5 fill-brand text-brand" />
            Account Marketplace
          </span>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl text-foreground tracking-tight leading-tight">
                Warmed-Up Accounts
              </h1>

              <p className="text-muted-foreground text-base sm:text-lg max-w-xl">
                Buy or sell aged Instagram and YouTube accounts with <strong className="text-foreground">5,000+ followers</strong>.
              </p>
            </div>

            <Button
              onClick={() => setIsSellModalOpen(true)}
              className="h-12 px-6 shrink-0 gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold shadow-lg transition-all transform hover:scale-[1.02]"
            >
              <PlusCircle className="w-5 h-5" />
              <span>List Your Account</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Feature Value Props Condensed Trust Strip */}
      {/* ponytail: merged 4 bloated cards into 1 condensed high-density trust strip to reduce vertical noise */}
      <div className="glass-card bg-card/30 border border-border/50 py-4 px-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 md:divide-x divide-border/30 text-sm">
        <div className="flex items-center gap-2.5 flex-1 justify-center md:justify-start">
          <Clock className="w-4 h-4 text-brand shrink-0" />
          <span className="font-semibold text-foreground">Zero Days Warmup</span>
        </div>
        <div className="flex items-center gap-2.5 flex-1 justify-center md:justify-start md:pl-6">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold text-foreground">Phone Verified (PVA)</span>
        </div>
        <div className="flex items-center gap-2.5 flex-1 justify-center md:justify-start md:pl-6">
          <Tag className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-semibold text-foreground">List & Sell Account</span>
        </div>
        <div className="flex items-center gap-2.5 flex-1 justify-center md:justify-start md:pl-6">
          <ShoppingBag className="w-4 h-4 text-purple-400 shrink-0" />
          <span className="font-semibold text-foreground">$10 Flat Price</span>
        </div>
      </div>

      {/* Main Tabs Navigation & Catalog Section */}
      <div className="space-y-6">
        <Tabs defaultValue="catalog" value={activeViewTab} onValueChange={(val: any) => setActiveViewTab(val)} className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
            <TabsList className="bg-card border border-border p-1 h-11">
              <TabsTrigger value="catalog" className="gap-2 text-xs sm:text-sm">
                <ShoppingBag className="w-4 h-4" />
                <span>Official Catalog</span>
              </TabsTrigger>
              <TabsTrigger value="community" className="gap-2 text-xs sm:text-sm">
                <Users className="w-4 h-4 text-teal-400" />
                <span>Community Listings</span>
                {verifiedCommunityListings.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 bg-teal-500/20 text-teal-300">
                    {verifiedCommunityListings.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="my_submissions" className="gap-2 text-xs sm:text-sm">
                <Tag className="w-4 h-4 text-amber-400" />
                <span>My Submissions</span>
                {(mySubmissions?.length ?? 0) > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-300">
                    {mySubmissions?.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search Input */}
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search platform or niche..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs bg-background/50 border-border"
                />
              </div>

              {/* Platform Filter Buttons */}
              <div className="inline-flex rounded-lg border border-border bg-card p-1">
                <button
                  onClick={() => setPlatformFilter("all")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                    platformFilter === "all"
                      ? "bg-brand text-brand-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All
                </button>
                <button
                  onClick={() => setPlatformFilter("instagram")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
                    platformFilter === "instagram"
                      ? "bg-brand text-brand-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Instagram className="w-3.5 h-3.5" />
                  Instagram
                </button>
                <button
                  onClick={() => setPlatformFilter("youtube")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
                    platformFilter === "youtube"
                      ? "bg-brand text-brand-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Youtube className="w-3.5 h-3.5" />
                  YouTube
                </button>
              </div>
            </div>
          </div>

          {/* Tab 1: Official Catalog */}
          <TabsContent value="catalog" className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCatalog.map((account, index) => {
                const isInstagram = account.platform === "instagram";
                const isPurchased = purchasedIds.includes(account.id);

                return (
                  <motion.div
                    key={account.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.2 }}
                    className={cn(
                      "glass-card relative flex flex-col justify-between p-6 transition-all duration-300 border-border hover:border-brand/50 hover:shadow-lg",
                      account.popular && "border-brand/40 bg-brand/[0.02]"
                    )}
                  >
                    {account.popular && (
                      <div className="absolute -top-3 right-4">
                        <span className="bg-brand text-brand-foreground text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                          <Star className="w-3 h-3 fill-brand-foreground" />
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Identity */}
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white",
                            isInstagram
                              ? "bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-500"
                              : "bg-red-500",
                          )}
                        >
                          {account.username.replace("@", "").charAt(0).toUpperCase()}
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-card bg-card">
                            {isInstagram ? (
                              <Instagram className="h-3 w-3 text-rose-400" />
                            ) : (
                              <Youtube className="h-3 w-3 text-red-500" />
                            )}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{account.username}</p>
                          <p className="truncate text-xs text-muted-foreground">{account.title}</p>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 divide-x divide-border/60 rounded-xl border border-border/80 bg-background/60 py-3 text-center">
                        <div>
                          <p className="font-display text-base text-foreground">{account.followersCount}</p>
                          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {isInstagram ? "Followers" : "Subs"}
                          </p>
                        </div>
                        <div>
                          <p className="font-display text-base text-foreground">
                            {account.avgViews.toLocaleString()}
                          </p>
                          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            Avg views
                          </p>
                        </div>
                        <div>
                          <p className="font-display text-base text-foreground">
                            {account.age.replace(/\s*Months? Aged/i, "mo")}
                          </p>
                          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            Age
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Footer Action */}
                    <div className="mt-5 flex items-center gap-3 border-t border-border/60 pt-4">
                      <span className="font-display text-lg text-foreground">${account.price}</span>
                      {isPurchased ? (
                        <Button
                          variant="outline"
                          className="flex-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-2"
                          disabled
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Connected to MagicBox
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleOpenDialog(account)}
                          className="flex-1 gap-2 transition-all group hover:bg-brand hover:text-brand-foreground"
                        >
                          <span>Select & Connect</span>
                          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          {/* Tab 2: Community Listings */}
          <TabsContent value="community" className="pt-4">
            {verifiedCommunityListings.length === 0 ? (
              <div className="glass-card p-12 text-center max-w-xl mx-auto space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center mx-auto">
                  <Users className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-display text-2xl text-foreground">No Community Listings Yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Be the first account owner to list your Instagram or YouTube account for sale to our creator community.
                  </p>
                </div>
                <Button
                  onClick={() => setIsSellModalOpen(true)}
                  className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
                >
                  <PlusCircle className="w-4 h-4" />
                  List Your Account
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {verifiedCommunityListings.map((item, index) => {
                  const isInstagram = item.platform === "instagram";
                  return (
                    <motion.div
                      key={item._id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04, duration: 0.2 }}
                      className="glass-card p-6 flex flex-col justify-between border-border space-y-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center text-xs border",
                                isInstagram
                                  ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                  : "bg-red-500/10 text-red-500 border-red-500/20"
                              )}
                            >
                              {isInstagram ? <Instagram className="w-4 h-4" /> : <Youtube className="w-4 h-4" />}
                            </div>
                            <div>
                              <h3 className="font-display text-base text-foreground leading-snug">{item.title}</h3>
                              <p className="text-xs text-muted-foreground">{item.handleOrUrl}</p>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs font-mono capitalize",
                              item.status === "verified"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                            )}
                          >
                            {item.status.replace("_", " ")}
                          </Badge>
                        </div>

                        {/* Metric Grid */}
                        <div className="grid grid-cols-3 gap-2 bg-background/60 p-3 rounded-lg border border-border/80 text-center">
                          <div>
                            <div className="text-[10px] font-mono text-muted-foreground uppercase">Followers</div>
                            <div className="text-sm font-bold text-foreground mt-0.5">
                              {item.followerCountLabel || item.followerCount.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] font-mono text-muted-foreground uppercase">Avg Views</div>
                            <div className="text-sm font-bold text-foreground mt-0.5">
                              {item.avgViews ? item.avgViews.toLocaleString() : "N/A"}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] font-mono text-muted-foreground uppercase">Rate</div>
                            <div className="text-sm font-bold text-emerald-400 mt-0.5">
                              {item.engagementRate || "N/A"}
                            </div>
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground space-y-1">
                          <div className="flex justify-between">
                            <span>Niche:</span>
                            <span className="text-foreground font-medium">{item.niche}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Account Age:</span>
                            <span className="text-foreground">{item.accountAgeMonths} Months</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Asking Price:</span>
                            <span className="text-emerald-400 font-bold">${item.askingPrice}</span>
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={() => {
                          toast.info(`Contacting seller: ${item.contactEmail}`, {
                            description: `Transfer details: ${item.transferNotes || "Direct transfer via MagicBox team."}`,
                          });
                        }}
                        className="w-full gap-2 text-xs"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Contact Seller (${item.askingPrice})</span>
                      </Button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Tab 3: My Submissions */}
          <TabsContent value="my_submissions" className="pt-4">
            {!mySubmissions || mySubmissions.length === 0 ? (
              <div className="glass-card p-12 text-center max-w-xl mx-auto space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
                  <Tag className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-display text-2xl text-foreground">No Account Listings Submitted</h3>
                  <p className="text-sm text-muted-foreground">
                    Have an Instagram or YouTube account with 5K+ followers? Submit it for sale and list it in our marketplace.
                  </p>
                </div>
                <Button
                  onClick={() => setIsSellModalOpen(true)}
                  className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
                >
                  <PlusCircle className="w-4 h-4" />
                  List Your Account
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg text-foreground flex items-center gap-2">
                    <Tag className="w-4 h-4 text-amber-400" />
                    <span>Your Submitted Account Listings</span>
                  </h3>
                  <Button onClick={() => setIsSellModalOpen(true)} size="sm" className="gap-1.5 text-xs">
                    <PlusCircle className="w-3.5 h-3.5" />
                    List Another Account
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {mySubmissions.map((submission) => {
                    const isInstagram = submission.platform === "instagram";
                    return (
                      <div key={submission._id} className="glass-card p-5 space-y-4 border-border">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center text-xs border",
                                isInstagram
                                  ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                  : "bg-red-500/10 text-red-500 border-red-500/20"
                              )}
                            >
                              {isInstagram ? <Instagram className="w-4 h-4" /> : <Youtube className="w-4 h-4" />}
                            </div>
                            <div>
                              <h4 className="font-display text-base text-foreground">{submission.title}</h4>
                              <p className="text-xs text-muted-foreground">{submission.handleOrUrl}</p>
                            </div>
                          </div>

                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs font-mono capitalize",
                              submission.status === "under_review" && "border-amber-500/30 bg-amber-500/10 text-amber-400",
                              submission.status === "verified" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
                              submission.status === "rejected" && "border-red-500/30 bg-red-500/10 text-red-400",
                              submission.status === "sold" && "border-blue-500/30 bg-blue-500/10 text-blue-400"
                            )}
                          >
                            {submission.status.replace("_", " ")}
                          </Badge>
                        </div>

                        <div className="p-3 bg-background/60 rounded-lg border border-border/80 text-xs space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Followers/Subs:</span>
                            <span className="font-semibold text-foreground">{submission.followerCountLabel || submission.followerCount.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Avg Views:</span>
                            <span className="text-foreground">{submission.avgViews ? submission.avgViews.toLocaleString() : "N/A"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Engagement Rate:</span>
                            <span className="text-emerald-400 font-medium">{submission.engagementRate || "N/A"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Asking Price:</span>
                            <span className="font-bold text-foreground">${submission.askingPrice}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Contact Email:</span>
                            <span className="text-foreground">{submission.contactEmail}</span>
                          </div>
                        </div>

                        {submission.status !== "sold" && (
                          <Button
                            onClick={() => handleMarkAsSold(submission._id)}
                            variant="outline"
                            className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Mark as Sold
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Comparison Matrix Section */}
      <div className="glass-card p-6 sm:p-8 space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="eyebrow justify-center">
            <TrendingUp className="w-3.5 h-3.5" />
            Why Buy or Sell Warmed-Up Accounts?
          </span>
          <h2 className="font-display text-3xl text-foreground">
            Fresh Account vs. Warmed-Up Account
          </h2>
          <p className="text-sm text-muted-foreground">
            Compare the time, risk, and reach of starting from scratch versus leveraging an aged account baseline.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-xs font-mono uppercase text-muted-foreground">
                <th className="py-3 px-4">Feature / Metric</th>
                <th className="py-3 px-4 text-red-400/90">Fresh New Account</th>
                <th className="py-3 px-4 text-brand bg-brand/5 rounded-t-lg font-bold">
                  MagicBox Warmed Account ($10)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">Followers & Social Proof</td>
                <td className="py-3 px-4 text-muted-foreground flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>0 Followers (Zero Social Proof)</span>
                </td>
                <td className="py-3 px-4 font-semibold text-emerald-400 bg-brand/5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>5,000 – 10,000 Real Followers</span>
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">Warmup Delay & Posting</td>
                <td className="py-3 px-4 text-muted-foreground">90+ Days of slow manual activity</td>
                <td className="py-3 px-4 font-semibold text-foreground bg-brand/5">0 Days (Instant 50+ posts/day)</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">Ban & Shadowban Risk</td>
                <td className="py-3 px-4 text-red-400">High risk of automated flags</td>
                <td className="py-3 px-4 font-semibold text-emerald-400 bg-brand/5">Zero (PVA Clean Reputation)</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">Pricing & Setup Value</td>
                <td className="py-3 px-4 text-muted-foreground">Time-intensive labor & proxy costs</td>
                <td className="py-3 px-4 font-semibold text-emerald-400 bg-brand/5">$10 Flat (Immediate Publishing)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Agency & Bulk Custom Requests CTA */}
      <div className="rounded-2xl border border-brand/30 bg-gradient-to-r from-brand/10 via-card to-brand/5 p-6 sm:p-8 md:flex md:items-center md:justify-between md:gap-8">
        <div className="max-w-2xl space-y-2">
          <span className="eyebrow">
            <Building2 className="w-3.5 h-3.5" />
            Bulk & Managed Enterprise Accounts
          </span>
          <h2 className="font-display text-2xl text-foreground sm:text-3xl">
            Need 10+ Accounts or Custom Sourcing?
          </h2>
          <p className="text-sm text-muted-foreground">
            We offer custom bulk account packages, specific niche sourcing, and full done-for-you agency management.
          </p>
        </div>
        <Button
          onClick={() => openBooking("warmed_up_bulk_request")}
          className="mt-5 h-11 shrink-0 gap-2 md:mt-0"
        >
          <CalendarClock className="w-4 h-4" />
          Book a Strategy Call
        </Button>
      </div>

      {/* MODAL 1: Account Purchase / Selection Dialog */}
      <Dialog open={!!selectedAccount} onOpenChange={(open) => !open && setSelectedAccount(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              <Flame className="w-5 h-5 text-brand" />
              {orderSuccess ? "Account Connected!" : "Connect Warmed-Up Account"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {orderSuccess
                ? "Your account credentials have been transferred and bound to your MagicBox workflow."
                : "Confirm your account preference to bind directly into MagicBox Studio and Maya AI."}
            </DialogDescription>
          </DialogHeader>

          {selectedAccount && !orderSuccess && (
            <div className="space-y-5 pt-2">
              <div className="p-4 rounded-xl bg-background/80 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-foreground">{selectedAccount.title}</span>
                  <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                    {selectedAccount.followersCount} {selectedAccount.platform === "instagram" ? "Followers" : "Subs"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{selectedAccount.age}</span>
                  <span className="font-display text-lg text-foreground">${selectedAccount.price} Flat</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Target Audience Niche</Label>
                <Select value={selectedNiche} onValueChange={setSelectedNiche}>
                  <SelectTrigger className="w-full bg-background border-border">
                    <SelectValue placeholder="Select a niche" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedAccount.nicheOptions.map((niche) => (
                      <SelectItem key={niche} value={niche}>
                        {niche}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-brand/5 border border-brand/20">
                <input
                  type="checkbox"
                  id="autoBind"
                  checked={autoBindWorkflow}
                  onChange={(e) => setAutoBindWorkflow(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border text-brand focus:ring-brand"
                />
                <label htmlFor="autoBind" className="text-xs text-foreground cursor-pointer space-y-0.5">
                  <div className="font-semibold text-foreground">1-Click MagicBox Auto-Bind</div>
                  <div className="text-muted-foreground">
                    Automatically connect credentials to Maya AI & Content Studio for immediate posting.
                  </div>
                </label>
              </div>

              <Button
                onClick={handleConfirmOrder}
                disabled={isOrdering}
                className="w-full h-11 gap-2 text-sm"
              >
                {isOrdering ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Reserving & Binding Account...
                  </>
                ) : (
                  <>
                    <span>Proceed with $10 Connection</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          )}

          {orderSuccess && (
            <div className="space-y-5 pt-2 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h4 className="font-display text-lg text-foreground">Ready for Automated Posting</h4>
                <p className="text-xs text-muted-foreground">
                  Credentials for <strong className="text-foreground">{selectedAccount?.title}</strong> ({selectedNiche}) have been reserved.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-background border border-border text-left text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account ID:</span>
                  <span className="font-mono text-foreground">{selectedAccount?.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="text-emerald-400 font-medium">Connector Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Warranty:</span>
                  <span className="text-foreground">30-Day Protected</span>
                </div>
              </div>

              <Button
                onClick={() => setSelectedAccount(null)}
                className="w-full h-10"
              >
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL 2: List Your Account for Sale Dialog */}
      <Dialog open={isSellModalOpen} onOpenChange={setIsSellModalOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border text-foreground max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center gap-2 text-foreground">
              <Tag className="w-5 h-5 text-emerald-400" />
              List Your Account for Sale
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Submit your Instagram or YouTube account metrics for review. Verified listings appear on our Community Marketplace.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitListing} className="space-y-4 pt-2">
            {/* Platform Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Social Platform *</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormPlatform("instagram")}
                  className={cn(
                    "p-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all",
                    formPlatform === "instagram"
                      ? "border-rose-500/50 bg-rose-500/10 text-rose-400 shadow-sm"
                      : "border-border bg-background/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Instagram className="w-4 h-4" />
                  <span>Instagram Account</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormPlatform("youtube")}
                  className={cn(
                    "p-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all",
                    formPlatform === "youtube"
                      ? "border-red-500/50 bg-red-500/10 text-red-400 shadow-sm"
                      : "border-border bg-background/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Youtube className="w-4 h-4" />
                  <span>YouTube Channel</span>
                </button>
              </div>
            </div>

            {/* Account Title */}
            <div className="space-y-1.5">
              <Label htmlFor="formTitle" className="text-xs font-semibold">Account Title / Display Name *</Label>
              <Input
                id="formTitle"
                placeholder={formPlatform === "instagram" ? "e.g., 10K Fitness & Workout IG" : "e.g., 5K Tech & SaaS Shorts Channel"}
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
                className="text-xs bg-background border-border"
              />
            </div>

            {/* Handle or Channel URL */}
            <div className="space-y-1.5">
              <Label htmlFor="formHandle" className="text-xs font-semibold">
                {formPlatform === "instagram" ? "Instagram Handle (@username) *" : "YouTube Channel ID / URL *"}
              </Label>
              <Input
                id="formHandle"
                placeholder={formPlatform === "instagram" ? "@fitness_daily_ig" : "https://youtube.com/@tech_shorts"}
                value={formHandle}
                onChange={(e) => setFormHandle(e.target.value)}
                required
                className="text-xs bg-background border-border"
              />
            </div>

            {/* Follower Count & Account Age */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="formFollowers" className="text-xs font-semibold">
                  {formPlatform === "instagram" ? "Follower Count *" : "Subscriber Count *"}
                </Label>
                <div className="relative">
                  <Input
                    id="formFollowers"
                    type="number"
                    min={100}
                    value={formFollowers}
                    onChange={(e) => setFormFollowers(Number(e.target.value))}
                    required
                    className="text-xs bg-background border-border pr-8"
                  />
                  <Users className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-3" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="formAgeMonths" className="text-xs font-semibold">Account Age (Months) *</Label>
                <Input
                  id="formAgeMonths"
                  type="number"
                  min={1}
                  value={formAgeMonths}
                  onChange={(e) => setFormAgeMonths(Number(e.target.value))}
                  required
                  className="text-xs bg-background border-border"
                />
              </div>
            </div>

            {/* Views, Likes, Engagement Rate */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="formAvgViews" className="text-xs font-semibold">Avg Views/Post</Label>
                <Input
                  id="formAvgViews"
                  type="number"
                  min={0}
                  value={formAvgViews}
                  onChange={(e) => setFormAvgViews(Number(e.target.value))}
                  className="text-xs bg-background border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="formAvgLikes" className="text-xs font-semibold">Avg Likes/Post</Label>
                <Input
                  id="formAvgLikes"
                  type="number"
                  min={0}
                  value={formAvgLikes}
                  onChange={(e) => setFormAvgLikes(Number(e.target.value))}
                  className="text-xs bg-background border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="formEngagementRate" className="text-xs font-semibold">Engagement %</Label>
                <Input
                  id="formEngagementRate"
                  placeholder="e.g. 4.5%"
                  value={formEngagementRate}
                  onChange={(e) => setFormEngagementRate(e.target.value)}
                  className="text-xs bg-background border-border"
                />
              </div>
            </div>

            {/* Niche & Asking Price */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Niche / Category *</Label>
                <Select value={formNiche} onValueChange={setFormNiche}>
                  <SelectTrigger className="w-full text-xs bg-background border-border">
                    <SelectValue placeholder="Select Niche" />
                  </SelectTrigger>
                  <SelectContent>
                    {NICHE_PRESETS.map((niche) => (
                      <SelectItem key={niche} value={niche} className="text-xs">
                        {niche}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="formAskingPrice" className="text-xs font-semibold">Asking Price ($ USD) *</Label>
                <div className="relative">
                  <Input
                    id="formAskingPrice"
                    type="number"
                    min={1}
                    value={formAskingPrice}
                    onChange={(e) => setFormAskingPrice(Number(e.target.value))}
                    required
                    className="text-xs bg-background border-border pl-7"
                  />
                  <DollarSign className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-3" />
                </div>
              </div>
            </div>

            {/* Contact Email */}
            <div className="space-y-1.5">
              <Label htmlFor="formContactEmail" className="text-xs font-semibold">Contact / Transfer Email *</Label>
              <Input
                id="formContactEmail"
                type="email"
                placeholder="your-email@domain.com"
                value={formContactEmail}
                onChange={(e) => setFormContactEmail(e.target.value)}
                required
                className="text-xs bg-background border-border"
              />
            </div>

            {/* Transfer Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="formTransferNotes" className="text-xs font-semibold">Transfer Notes / Included Features</Label>
              <Textarea
                id="formTransferNotes"
                placeholder="e.g. Includes primary Gmail access, phone verified, 0 copyright strikes, ready for 2FA transfer."
                value={formTransferNotes}
                onChange={(e) => setFormTransferNotes(e.target.value)}
                rows={2}
                className="text-xs bg-background border-border resize-none"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmittingListing}
              className="w-full h-11 gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold shadow-md mt-2"
            >
              {isSubmittingListing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Listing for Verification...</span>
                </>
              ) : (
                <>
                  <Tag className="w-4 h-4" />
                  <span>Submit Account for Verification ($10 Standard)</span>
                </>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
