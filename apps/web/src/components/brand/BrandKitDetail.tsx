import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { BrandProfile } from "@shared/types";
import { updateBrandProfile } from "@shared/lib/automations";
import { Button } from "@shared/components/ui/button";
import { Input } from "@shared/components/ui/input";
import { Textarea } from "@shared/components/ui/textarea";
import { cn } from "@shared/lib/utils";
import { isConvexConfigured } from "../../lib/convex";
import { Loader2, Pencil, Trash2, Plus, ThumbsUp, ThumbsDown, Link as LinkIcon } from "lucide-react";

export function BrandKitDetail({ brand, onUpdated }: { brand: BrandProfile; onUpdated: () => void }) {
  const [saving, setSaving] = useState(false);
  
  const updateDetails = useMutation(api.brands.updateDetails);

  const handleSaveData = async (updates: Partial<BrandProfile>) => {
    if (!brand.id || brand.id === "preview") {
      toast.info("Please save the brand kit first before editing.");
      return;
    }
    setSaving(true);
    try {
      await updateBrandProfile(brand.id, updates);
      if (isConvexConfigured) {
        try {
          await updateDetails({ legacyId: brand.id, ...updates });
        } catch (e) {
          console.warn("Failed to sync brand details to convex", e);
        }
      }
      toast.success("Saved details");
      onUpdated();
    } catch (e) {
      toast.error("Failed to save details");
    } finally {
      setSaving(false);
    }
  };

  // Header Component
  const Header = () => {
    return (
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-orange-50 border border-orange-100 text-orange-600 font-display text-xl">
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt="Logo" className="h-full w-full object-contain p-1 rounded-xl" />
            ) : (
              brand.name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl">{brand.name}</h2>
              <Pencil className="h-3 w-3 text-muted-foreground cursor-pointer" />
            </div>
            <p className="text-sm text-muted-foreground">
              {brand.websiteUrl?.replace(/^https?:\/\//, "")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="bg-transparent text-xs pointer-events-none opacity-50">
            Content Hub
          </Button>
          <Button variant="outline" size="sm" className="bg-transparent text-xs" onClick={() => window.open('https://discord.com', '_blank')}>
            Discord
          </Button>
        </div>
      </div>
    );
  };

  // Content Angles Component
  const ContentAngles = () => {
    const [angles, setAngles] = useState(brand.contentAngles || []);
    
    useEffect(() => {
      setAngles(brand.contentAngles || []);
    }, [brand.contentAngles]);

    const addAngle = () => {
      const newAngles = [...angles, "New Content Angle"];
      handleSaveData({ contentAngles: newAngles });
    };

    const removeAngle = (idx: number) => {
      const newAngles = angles.filter((_, i) => i !== idx);
      handleSaveData({ contentAngles: newAngles });
    };

    const editAngle = (idx: number, val: string) => {
      const newAngles = [...angles];
      newAngles[idx] = val;
      setAngles(newAngles);
    };

    const saveAngles = () => {
      handleSaveData({ contentAngles: angles });
    };

    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg">Content Angles</h3>
          <Button size="sm" className="h-7 bg-[#E85D04] hover:bg-[#D05303] text-white text-xs px-3" onClick={addAngle}>
            <Plus className="mr-1 h-3 w-3" /> Add
          </Button>
        </div>
        <div className="space-y-2">
          {angles.map((angle, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 group">
              <input
                className="bg-transparent border-none text-sm w-full focus:outline-none focus:ring-0 p-0"
                value={angle}
                onChange={(e) => editAngle(i, e.target.value)}
                onBlur={saveAngles}
              />
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Pencil className="h-3 w-3 text-muted-foreground cursor-pointer" />
                <Trash2 className="h-3 w-3 text-muted-foreground cursor-pointer" onClick={() => removeAngle(i)} />
              </div>
            </div>
          ))}
          {angles.length === 0 && <p className="text-sm text-muted-foreground italic">No content angles defined.</p>}
        </div>
      </div>
    );
  };

  // Tone & Voice Component
  const ToneAndVoice = () => {
    const [dos, setDos] = useState(brand.toneDos || []);
    const [donts, setDonts] = useState(brand.toneDonts || []);
    const [newDo, setNewDo] = useState("");
    const [newDont, setNewDont] = useState("");

    const addDo = () => {
      if (!newDo.trim()) return;
      const newArr = [...dos, newDo.trim()];
      setNewDo("");
      handleSaveData({ toneDos: newArr });
    };

    const addDont = () => {
      if (!newDont.trim()) return;
      const newArr = [...donts, newDont.trim()];
      setNewDont("");
      handleSaveData({ toneDonts: newArr });
    };

    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4">
          <h3 className="font-display text-lg">Tone & Voice</h3>
          <p className="text-xs text-muted-foreground mt-1">Define rules for how your content copy should sound. These apply to all generated content text.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ThumbsUp className="h-4 w-4 text-emerald-500" />
              <span className="font-semibold text-sm">Do's</span>
              <span className="text-xs text-muted-foreground">({dos.length}/10)</span>
            </div>
            <div className="flex gap-2 mb-4">
              <Input 
                placeholder="e.g., Use casual, conversational tone" 
                className="h-8 text-xs bg-transparent" 
                value={newDo}
                onChange={(e) => setNewDo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addDo()}
                disabled={dos.length >= 10}
              />
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={addDo} disabled={dos.length >= 10}>
                <Plus className="mr-1 h-3 w-3" /> Add
              </Button>
            </div>
            <ul className="space-y-2">
              {dos.map((item, i) => (
                <li key={i} className="text-sm flex items-center justify-between group">
                  <span>{item}</span>
                  <Trash2 className="h-3 w-3 text-muted-foreground cursor-pointer opacity-0 group-hover:opacity-100" onClick={() => {
                    const arr = dos.filter((_, idx) => idx !== i);
                    handleSaveData({ toneDos: arr });
                  }} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ThumbsDown className="h-4 w-4 text-red-500" />
              <span className="font-semibold text-sm">Don'ts</span>
              <span className="text-xs text-muted-foreground">({donts.length}/10)</span>
            </div>
            <div className="flex gap-2 mb-4">
              <Input 
                placeholder="e.g., Never use corporate jargon" 
                className="h-8 text-xs bg-transparent" 
                value={newDont}
                onChange={(e) => setNewDont(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addDont()}
                disabled={donts.length >= 10}
              />
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={addDont} disabled={donts.length >= 10}>
                <Plus className="mr-1 h-3 w-3" /> Add
              </Button>
            </div>
            <ul className="space-y-2">
              {donts.map((item, i) => (
                <li key={i} className="text-sm flex items-center justify-between group">
                  <span>{item}</span>
                  <Trash2 className="h-3 w-3 text-muted-foreground cursor-pointer opacity-0 group-hover:opacity-100" onClick={() => {
                    const arr = donts.filter((_, idx) => idx !== i);
                    handleSaveData({ toneDonts: arr });
                  }} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  // Identity & Purpose Component
  const IdentityPurposeCards = () => {
    const [editing, setEditing] = useState<"identity" | "positioning" | null>(null);
    
    const [coreIdentity, setCoreIdentity] = useState(brand.coreIdentity || "");
    const [productOffering, setProductOffering] = useState(brand.productOffering || "");
    const [uniqueBenefits, setUniqueBenefits] = useState(brand.uniqueBenefits || "");
    const [problemSolution, setProblemSolution] = useState(brand.problemSolution || "");
    
    const [mission, setMission] = useState(brand.mission || "");
    const [differentiation, setDifferentiation] = useState(brand.differentiation || "");
    const [ownedSpace, setOwnedSpace] = useState(brand.ownedSpace || "");

    useEffect(() => {
      setCoreIdentity(brand.coreIdentity || "");
      setProductOffering(brand.productOffering || "");
      setUniqueBenefits(brand.uniqueBenefits || "");
      setProblemSolution(brand.problemSolution || "");
      setMission(brand.mission || "");
      setDifferentiation(brand.differentiation || "");
      setOwnedSpace(brand.ownedSpace || "");
      setEditing(null);
    }, [brand]);

    const handleSaveSection = async (section: "identity" | "positioning") => {
      const updates = section === "identity" 
        ? { coreIdentity, productOffering, uniqueBenefits, problemSolution }
        : { mission, differentiation, ownedSpace };
      await handleSaveData(updates);
      setEditing(null);
    };

    const renderField = (label: string, value: string, setValue: (v: string) => void, isEditing: boolean, isOrange?: boolean) => (
      <div className={cn(isOrange && "rounded-xl bg-[#FFF6EF] p-5")}>
        <h4 className={cn("mb-2 font-mono text-[10px] uppercase tracking-wider", isOrange ? "text-[#E85D04]" : "text-muted-foreground")}>
          {label}
        </h4>
        {isEditing ? (
          <Textarea 
            value={value} 
            onChange={(e) => setValue(e.target.value)} 
            className={cn("min-h-[80px] text-sm resize-none", isOrange && "bg-white/60 border-orange-200 focus-visible:ring-orange-500")}
          />
        ) : (
          <p className={cn("text-[13px] leading-relaxed", isOrange ? "text-[#9A3412]" : "text-foreground/90")}>
            {value ? value : <span className="opacity-50 italic">Not specified</span>}
          </p>
        )}
      </div>
    );

    return (
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-display text-lg">Identity & Product</h3>
            {editing === "identity" ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(null)} disabled={saving} className="h-7 text-xs px-2">Cancel</Button>
                <Button size="sm" onClick={() => handleSaveSection("identity")} disabled={saving} className="h-7 text-xs px-2">
                  {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Save
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[10px] uppercase text-muted-foreground" onClick={() => setEditing("identity")}>
                 Edit
              </Button>
            )}
          </div>
          <div className="space-y-6">
            {renderField("Core Identity", coreIdentity, setCoreIdentity, editing === "identity")}
            {renderField("Product Offering", productOffering, setProductOffering, editing === "identity")}
            {renderField("Unique Benefits", uniqueBenefits, setUniqueBenefits, editing === "identity")}
            {renderField("Problem Solution", problemSolution, setProblemSolution, editing === "identity")}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-display text-lg">Purpose & Positioning</h3>
            {editing === "positioning" ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(null)} disabled={saving} className="h-7 text-xs px-2">Cancel</Button>
                <Button size="sm" onClick={() => handleSaveSection("positioning")} disabled={saving} className="h-7 text-xs px-2">
                  {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Save
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[10px] uppercase text-muted-foreground" onClick={() => setEditing("positioning")}>
                 Edit
              </Button>
            )}
          </div>
          <div className="space-y-6">
            {renderField("Mission", mission, setMission, editing === "positioning")}
            {renderField("Differentiation", differentiation, setDifferentiation, editing === "positioning")}
            {renderField("Owned Space", ownedSpace, setOwnedSpace, editing === "positioning", true)}
          </div>
        </div>
      </div>
    );
  };

  // Market & Competition Component
  const MarketAndCompetition = () => {
    const [isEditing, setIsEditing] = useState(false);
    const [segments, setSegments] = useState(brand.customerSegments?.length ? brand.customerSegments : []);
    const [comps, setComps] = useState(brand.competitors?.length ? brand.competitors : []);
    const [newComp, setNewComp] = useState("");

    useEffect(() => {
      setSegments(brand.customerSegments?.length ? brand.customerSegments : []);
      setComps(brand.competitors?.length ? brand.competitors : []);
    }, [brand.customerSegments, brand.competitors]);

    const segmentColors = ["bg-[#0099FF]", "bg-[#9933FF]", "bg-[#FF3399]", "bg-[#FF9900]", "bg-[#33CC33]"];

    const saveMarket = () => {
      handleSaveData({ customerSegments: segments, competitors: comps });
      setIsEditing(false);
    };

    const addSegment = () => {
      setSegments([...segments, { segmentName: "New Segment", percentage: 0 }]);
    };

    const removeSegment = (idx: number) => {
      setSegments(segments.filter((_, i) => i !== idx));
    };

    const addCompetitor = () => {
      if (!newComp.trim()) return;
      setComps([...comps, newComp.trim()]);
      setNewComp("");
    };

    const removeCompetitor = (idx: number) => {
      setComps(comps.filter((_, i) => i !== idx));
    };

    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-display text-lg">Market & Competition</h3>
          {isEditing ? (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setSegments(brand.customerSegments?.length ? brand.customerSegments : []); setComps(brand.competitors?.length ? brand.competitors : []); }} disabled={saving} className="h-7 text-xs px-2">Cancel</Button>
              <Button size="sm" onClick={saveMarket} disabled={saving} className="h-7 text-xs px-3 bg-[#E85D04] hover:bg-[#D05303] text-white">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[10px] uppercase text-muted-foreground" onClick={() => setIsEditing(true)}>
               Edit
            </Button>
          )}
        </div>
        <div className="grid md:grid-cols-2 gap-10">
          <div>
            <h4 className="mb-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Customer Segments</h4>
            
            {segments.length > 0 ? (
              <>
                {!isEditing && (
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden flex mb-6">
                    {segments.map((seg, i) => (
                      <div key={i} className={cn("h-full", segmentColors[i % segmentColors.length])} style={{ width: `${seg.percentage}%` }} />
                    ))}
                  </div>
                )}
                
                <div className="space-y-3">
                  {segments.map((seg, i) => (
                    <div key={i} className="flex items-center justify-between text-[13px] gap-2">
                      {isEditing ? (
                        <>
                          <Input
                            className="h-7 text-xs flex-1"
                            value={seg.segmentName}
                            onChange={(e) => {
                              const updated = [...segments];
                              updated[i] = { ...updated[i], segmentName: e.target.value };
                              setSegments(updated);
                            }}
                          />
                          <Input
                            className="h-7 text-xs w-16"
                            type="number"
                            value={seg.percentage}
                            onChange={(e) => {
                              const updated = [...segments];
                              updated[i] = { ...updated[i], percentage: Number(e.target.value) || 0 };
                              setSegments(updated);
                            }}
                          />
                          <span className="text-muted-foreground text-xs">%</span>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground cursor-pointer hover:text-red-500 shrink-0" onClick={() => removeSegment(i)} />
                        </>
                      ) : (
                        <>
                          <span>{seg.segmentName}</span>
                          <span className="text-muted-foreground bg-secondary px-2 py-0.5 rounded-md text-xs">{seg.percentage}%</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">No segments detected. Click Edit to add.</p>
            )}
            {isEditing && (
              <Button variant="ghost" size="sm" className="mt-3 h-7 text-xs gap-1" onClick={addSegment}>
                <Plus className="h-3 w-3" /> Add Segment
              </Button>
            )}
          </div>
          <div>
            <h4 className="mb-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Competitors</h4>
            {comps.length > 0 ? (
              <div className="flex flex-wrap gap-2.5">
                {comps.map((comp, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-full border border-border/80 px-3 py-1.5 text-[11px] text-foreground/80 hover:bg-secondary cursor-default transition-colors">
                    {comp}
                    {isEditing ? (
                      <Trash2 className="h-3 w-3 text-muted-foreground/60 cursor-pointer hover:text-red-500" onClick={() => removeCompetitor(i)} />
                    ) : (
                      <LinkIcon className="h-3 w-3 text-muted-foreground/60" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No competitors detected. Click Edit to add.</p>
            )}
            {isEditing && (
              <div className="mt-3 flex items-center gap-2">
                <Input
                  className="h-7 text-xs flex-1"
                  placeholder="e.g., Competitor Name"
                  value={newComp}
                  onChange={(e) => setNewComp(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addCompetitor(); }}
                />
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={addCompetitor}>
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 mt-6">
      <Header />
      <ContentAngles />
      <ToneAndVoice />
      <IdentityPurposeCards />
      <MarketAndCompetition />
    </div>
  );
}
